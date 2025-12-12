// app/src/adapters/S3Adapter.js
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import "dotenv/config";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("S3Adapter");

class S3Adapter {
  constructor() {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || "us-east-1",
    });
    this.bucket = process.env.S3_BUCKET;
    this.prefix = process.env.S3_PREFIX || "";
    this.pageSize = 100;
    
    logger.info("S3Adapter initialized", {
      bucket: this.bucket,
      prefix: this.prefix,
      region: process.env.AWS_REGION || "us-east-1"
    });
  }

  /**
   * Creates an artifact and stores it in S3
   * Each artifact is stored as a JSON file: {prefix}{type}/{id}.json
   */
  async createArtifact(input) {
    logger.info("Creating artifact", { type: input.type, name: input.name });
    
    // Normalize URL for comparison/storage
    const rawUrl = String(input.url);
    let normalizedUrl = rawUrl;
    try {
      normalizedUrl = new URL(rawUrl).href;
    } catch {
      // leave as-is; higher layers should validate URLs
      normalizedUrl = rawUrl;
    }

    // Check for existing artifact with same URL (across all types)
    logger.debug("Checking for duplicate URL", { url: normalizedUrl });
    await this._checkDuplicateUrl(normalizedUrl);

    const id = randomUUID();
    const artifact = {
      metadata: { name: input.name, id, type: input.type },
      data: { url: normalizedUrl },
    };

    // Store in S3: {prefix}{type}/{id}.json
    const key = `${this.prefix}${input.type}/${id}.json`;
    logger.debug("Storing artifact in S3", { bucket: this.bucket, key });
    
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: JSON.stringify(artifact),
      ContentType: "application/json",
    });

    await this.s3Client.send(command);
    logger.info("Artifact created successfully", { id, type: input.type, name: input.name });
    return artifact;
  }

  /**
   * Retrieves an artifact from S3
   */
  async getArtifact(query) {
    const key = `${this.prefix}${query.type}/${query.id}.json`;
    logger.debug("Getting artifact", { type: query.type, id: query.id, key });
    
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      
      const response = await this.s3Client.send(command);
      const body = await response.Body.transformToString();
      logger.info("Artifact retrieved successfully", { type: query.type, id: query.id });
      return JSON.parse(body);
    } catch (error) {
      // If object doesn't exist, return null (matching LocalAdapter behavior)
      if (error.name === "NoSuchKey" || error.$metadata?.httpStatusCode === 404) {
        logger.warn("Artifact not found", { type: query.type, id: query.id });
        return null;
      }
      logger.error("Error retrieving artifact", { type: query.type, id: query.id, error: error.message });
      throw error;
    }
  }

  /**
   * Update an artifact's URL in S3
   */
  async updateArtifact({ type, id, url }) {
    logger.info("Updating artifact", { type, id });
    const key = `${this.prefix}${type}/${id}.json`;
    try {
      const getCmd = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      const resp = await this.s3Client.send(getCmd);
      const body = await resp.Body.transformToString();
      const artifact = JSON.parse(body);

      const rawUrl = String(url);
      let normalizedUrl = rawUrl;
      try {
        normalizedUrl = new URL(rawUrl).href;
      } catch {
        normalizedUrl = rawUrl;
      }

      const existing = artifact?.data?.url;
      let existingNormalized = existing;
      try {
        existingNormalized = new URL(String(existing)).href;
      } catch {
        // keep as-is
      }

      // No change in URL
      if (existingNormalized === normalizedUrl) {
        logger.debug("No URL change detected", { type, id });
        return artifact;
      }

      const updated = {
        ...artifact,
        data: { ...artifact.data, url: normalizedUrl },
      };

      const putCmd = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: JSON.stringify(updated),
        ContentType: "application/json",
      });
      await this.s3Client.send(putCmd);
      logger.info("Artifact updated successfully", { type, id });
      return updated;
    } catch (error) {
      if (error.name === "NoSuchKey" || error.$metadata?.httpStatusCode === 404) {
        logger.warn("Artifact not found for update", { type, id });
        return null;
      }
      logger.error("Error updating artifact", { type, id, error: error.message });
      throw error;
    }
  }

  /**
   * Delete an artifact from S3
   */
  async deleteArtifact({ type, id }) {
    logger.info("Deleting artifact", { type, id });
    const key = `${this.prefix}${type}/${id}.json`;

    try {
      // First check if the artifact exists
      const getCmd = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      await this.s3Client.send(getCmd);

      // If it exists, delete it
      const deleteCmd = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      await this.s3Client.send(deleteCmd);
      logger.info("Artifact deleted successfully", { type, id });
      return true; // Successfully deleted
    } catch (error) {
      // If object doesn't exist, return false
      if (error.name === "NoSuchKey" || error.$metadata?.httpStatusCode === 404) {
        logger.warn("Artifact not found for deletion", { type, id });
        return false;
      }
      logger.error("Error deleting artifact", { type, id, error: error.message });
      throw error;
    }
  }

  /**
   * Reset the registry by deleting all objects under the configured prefix
   * Handles pagination for large buckets (>1000 objects)
   */
  async reset() {
    logger.warn("Starting registry reset - deleting all artifacts");
    try {
      let continuationToken;
      let hasMore = true;
      let deletedCount = 0;

      // Paginate through all objects
      while (hasMore) {
        const listCmd = new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: this.prefix,
          ContinuationToken: continuationToken,
        });

        const listResp = await this.s3Client.send(listCmd);
        const contents = listResp.Contents || [];
        
        for (const item of contents) {
          if (!item.Key) continue;
          const delCmd = new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: item.Key,
          });
          try {
            await this.s3Client.send(delCmd);
            deletedCount++;
          } catch (err) {
            // Log and continue with best-effort deletion
            logger.error("Failed to delete S3 object during reset", { key: item.Key, error: err.message });
            continue;
          }
        }

        // Check if there are more objects to list
        hasMore = listResp.IsTruncated || false;
        continuationToken = listResp.NextContinuationToken;
      }
      
      logger.warn("Registry reset completed", { deletedCount });
    } catch (err) {
      // Surface error to caller
      logger.error("Error during S3 reset", { error: err.message });
      throw err;
    }
  }

  /**
   * Check if URL already exists in any artifact
   * This is expensive on S3, but maintains parity with LocalAdapter
   */
  async _checkDuplicateUrl(normalizedUrl) {
    try {
      // List all objects under the prefix
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: this.prefix,
      });

      const response = await this.s3Client.send(command);
      
      if (!response.Contents || response.Contents.length === 0) {
        return; // No duplicates
      }

      // Check each artifact for duplicate URL
      for (const item of response.Contents) {
        if (!item.Key.endsWith('.json')) continue;

        try {
          const getCommand = new GetObjectCommand({
            Bucket: this.bucket,
            Key: item.Key,
          });
          
          const obj = await this.s3Client.send(getCommand);
          const body = await obj.Body.transformToString();
          const artifact = JSON.parse(body);
          
          const storedUrl = artifact?.data?.url;
          if (!storedUrl) continue;

          let storedNormalized;
          try {
            storedNormalized = new URL(String(storedUrl)).href;
          } catch {
            continue;
          }

          if (storedNormalized === normalizedUrl) {
            const err = new Error("Artifact exists already.");
            err.code = "ARTIFACT_EXISTS";
            throw err;
          }
        } catch (error) {
          // If it's our ARTIFACT_EXISTS error, rethrow it
          if (error.code === "ARTIFACT_EXISTS") {
            throw error;
          }
          // Otherwise, skip this artifact and continue checking
          continue;
        }
      }
    } catch (error) {
      // If it's our ARTIFACT_EXISTS error, rethrow it
      if (error.code === "ARTIFACT_EXISTS") {
        throw error;
      }
      // For other errors, log and continue (fail open for now)
      console.error("Error checking for duplicate URLs:", error);
    }
  }

  // Enumerate artifacts matching queries (POST /artifacts)
  async searchArtifacts(queries, offset = 0) {
    const limit = this.pageSize;
    const hasWildcard = queries.some((q) => q.name === "*");
    const wildcardTypes = new Set();
    for (const q of queries) {
      if (q.name === "*" && Array.isArray(q.types)) {
        for (const t of q.types) wildcardTypes.add(t);
      }
    }

    const seen = new Set();
    const artifacts = [];
    let skipped = 0;
    let continuationToken;
    let more = false;

    const matchesQuery = (artifact) => {
      const meta = artifact?.metadata || {};
      if (!meta.name || !meta.type || !meta.id) return false;

      if (hasWildcard) {
        if (wildcardTypes.size === 0) return true;
        return wildcardTypes.has(meta.type);
      }

      for (const q of queries) {
        if (q.name !== meta.name) continue;
        if (q.types && q.types.length > 0 && !q.types.includes(meta.type)) continue;
        return true;
      }
      return false;
    };

    while (true) {
      const listCmd = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: this.prefix,
        ContinuationToken: continuationToken,
      });
      const listResp = await this.s3Client.send(listCmd);
      const contents = listResp.Contents || [];

      for (const item of contents) {
        if (!item.Key || !item.Key.endsWith(".json")) continue;
        try {
          const getCmd = new GetObjectCommand({
            Bucket: this.bucket,
            Key: item.Key,
          });
          const resp = await this.s3Client.send(getCmd);
          const body = await resp.Body.transformToString();
          const artifact = JSON.parse(body);
          if (!matchesQuery(artifact)) continue;

          const meta = artifact.metadata;
          const dedupKey = `${meta.type}:${meta.id}`;
          if (seen.has(dedupKey)) continue;
          seen.add(dedupKey);

          if (skipped < offset) {
            skipped += 1;
            continue;
          }

          if (artifacts.length < limit) {
            artifacts.push({ ...meta });
          } else {
            more = true;
            break;
          }
        } catch (err) {
          // Skip malformed objects
          console.error("Skipping malformed artifact during search:", err);
          continue;
        }
      }

      if (more || !listResp.IsTruncated) {
        break;
      }
      continuationToken = listResp.NextContinuationToken;
    }

    const nextOffset = more ? offset + artifacts.length : null;
    return { artifacts, nextOffset };
  }

  // Enumerate artifacts whose names match regex
  async searchArtifactsByRegex(regex, offset = 0) {
    const limit = this.pageSize;
    const re = new RegExp(regex);
    const artifacts = [];
    let skipped = 0;
    let continuationToken;
    let more = false;

    while (true) {
      const listCmd = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: this.prefix,
        ContinuationToken: continuationToken,
      });
      const listResp = await this.s3Client.send(listCmd);
      const contents = listResp.Contents || [];

      for (const item of contents) {
        if (!item.Key || !item.Key.endsWith(".json")) continue;
        try {
          const getCmd = new GetObjectCommand({
            Bucket: this.bucket,
            Key: item.Key,
          });
          const resp = await this.s3Client.send(getCmd);
          const body = await resp.Body.transformToString();
          const artifact = JSON.parse(body);
          const meta = artifact?.metadata;
          if (!meta?.name || !re.test(meta.name)) continue;

          if (skipped < offset) {
            skipped += 1;
            continue;
          }
          if (artifacts.length < limit) {
            artifacts.push({ ...meta });
          } else {
            more = true;
            break;
          }
        } catch (err) {
          console.error("Skipping malformed artifact during regex search:", err);
          continue;
        }
      }

      if (more || !listResp.IsTruncated) break;
      continuationToken = listResp.NextContinuationToken;
    }

    const nextOffset = more ? offset + artifacts.length : null;
    return { artifacts, nextOffset };
  }

  // Security Track: Debloat program management
  /**
   * Store a debloat validation program for an artifact
   * Stored as: {prefix}debloat/{type}/{id}.json
   */
  async storeDebloatProgram(type, id, program, username) {
    const key = `${this.prefix}debloat/${type}/${id}.json`;
    const data = {
      artifact_type: type,
      artifact_id: id,
      program: program,
      uploaded_by: username,
      uploaded_at: new Date().toISOString()
    };

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: JSON.stringify(data),
      ContentType: "application/json",
    });

    await this.s3Client.send(command);
    return { success: true };
  }

  /**
   * Retrieve the debloat program for an artifact
   */
  async getDebloatProgram(type, id) {
    const key = `${this.prefix}debloat/${type}/${id}.json`;
    
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      
      const response = await this.s3Client.send(command);
      const body = await response.Body.transformToString();
      return JSON.parse(body);
    } catch (error) {
      if (error.name === "NoSuchKey" || error.$metadata?.httpStatusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Delete the debloat program for an artifact
   */
  async deleteDebloatProgram(type, id) {
    const key = `${this.prefix}debloat/${type}/${id}.json`;
    
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      
      await this.s3Client.send(command);
      return true;
    } catch (error) {
      if (error.name === "NoSuchKey" || error.$metadata?.httpStatusCode === 404) {
        return false; // Nothing to delete
      }
      throw error;
    }
  }

  // Security Track: Historical tracking
  /**
   * Record a history entry for an artifact
   * Stored as: {prefix}history/{type}/{id}/{timestamp}.json
   */
  async recordHistory(type, id, username, action, changes) {
    const timestamp = Date.now();
    const key = `${this.prefix}history/${type}/${id}/${timestamp}.json`;
    
    const entry = {
      artifact_type: type,
      artifact_id: id,
      timestamp: new Date(timestamp).toISOString(),
      user: username,
      action: action,
      changes: changes
    };

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: JSON.stringify(entry),
      ContentType: "application/json",
    });

    await this.s3Client.send(command);
    return { success: true };
  }

  /**
   * Retrieve history entries for an artifact
   */
  async getArtifactHistory(type, id, limit = 100) {
    const prefix = `${this.prefix}history/${type}/${id}/`;
    
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
        MaxKeys: limit
      });
      
      const response = await this.s3Client.send(command);
      
      if (!response.Contents || response.Contents.length === 0) {
        return [];
      }

      // Fetch all history entries
      const historyPromises = response.Contents.map(async (item) => {
        try {
          const getCmd = new GetObjectCommand({
            Bucket: this.bucket,
            Key: item.Key,
          });
          const obj = await this.s3Client.send(getCmd);
          const body = await obj.Body.transformToString();
          return JSON.parse(body);
        } catch (err) {
          console.error("Failed to fetch history entry:", item.Key, err);
          return null;
        }
      });

      const entries = await Promise.all(historyPromises);
      // Filter out nulls and sort by timestamp (newest first)
      return entries
        .filter(e => e !== null)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
    } catch (error) {
      if (error.name === "NoSuchKey" || error.$metadata?.httpStatusCode === 404) {
        return [];
      }
      throw error;
    }
  }
}

export default S3Adapter;
