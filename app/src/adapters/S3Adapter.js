// app/src/adapters/S3Adapter.js
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import "dotenv/config";

class S3Adapter {
  constructor() {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || "us-east-1",
    });
    this.bucket = process.env.S3_BUCKET;
    this.prefix = process.env.S3_PREFIX || "";
  }

  /**
   * Creates an artifact and stores it in S3
   * Each artifact is stored as a JSON file: {prefix}{type}/{id}.json
   */
  async createArtifact(input) {
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
    await this._checkDuplicateUrl(normalizedUrl);

    const id = randomUUID();
    const artifact = {
      metadata: { name: input.name, id, type: input.type },
      data: { url: normalizedUrl },
    };

    // Store in S3: {prefix}{type}/{id}.json
    const key = `${this.prefix}${input.type}/${id}.json`;
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: JSON.stringify(artifact),
      ContentType: "application/json",
    });

    await this.s3Client.send(command);
    return artifact;
  }

  /**
   * Retrieves an artifact from S3
   */
  async getArtifact(query) {
    const key = `${this.prefix}${query.type}/${query.id}.json`;
    
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      
      const response = await this.s3Client.send(command);
      const body = await response.Body.transformToString();
      return JSON.parse(body);
    } catch (error) {
      // If object doesn't exist, return null (matching LocalAdapter behavior)
      if (error.name === "NoSuchKey" || error.$metadata?.httpStatusCode === 404) {
        return null;
      }
      throw error;
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
}

export default S3Adapter;