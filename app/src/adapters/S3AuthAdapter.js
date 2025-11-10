// app/src/adapters/S3AuthAdapter.js
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import "dotenv/config";

/**
 * S3AuthAdapter - Manages authentication data storage in a dedicated S3 bucket
 * 
 * This adapter stores user credentials and authentication tokens in a separate
 * S3 bucket for security isolation from artifact storage.
 * 
 * Storage structure:
 *   - users/{username}.json - User credentials and metadata
 *   - tokens/{tokenHash}.json - Active tokens and their associated users
 *   - audit/{username}/{timestamp}.json - Authentication audit logs
 */
class S3AuthAdapter {
  constructor() {
    this.s3Client = new S3Client({
      region: process.env.AWS_AUTH_REGION || process.env.AWS_REGION || "us-east-1",
    });
    
    // Use dedicated auth bucket, fallback to main bucket with prefix
    this.bucket = process.env.S3_AUTH_BUCKET || process.env.S3_BUCKET;
    this.prefix = process.env.S3_AUTH_PREFIX || "auth/";
    
    // Ensure prefix ends with /
    if (this.prefix && !this.prefix.endsWith("/")) {
      this.prefix += "/";
    }
  }

  /**
   * Store user credentials
   * @param {Object} user - User object with name, is_admin, and password_hash
   * @returns {Promise<Object>} Stored user object (without password)
   */
  async createUser(user) {
    const key = `${this.prefix}users/${user.name}.json`;
    
    const userData = {
      name: user.name,
      is_admin: user.is_admin,
      password_hash: user.password_hash,
      created_at: new Date().toISOString(),
    };

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: JSON.stringify(userData),
      ContentType: "application/json",
    });

    await this.s3Client.send(command);
    
    // Return user without password_hash
    const { password_hash, ...safeUser } = userData;
    return safeUser;
  }

  /**
   * Retrieve user credentials
   * @param {string} username - Username to retrieve
   * @returns {Promise<Object|null>} User object or null if not found
   */
  async getUser(username) {
    const key = `${this.prefix}users/${username}.json`;

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
   * Store an active authentication token
   * @param {string} tokenHash - Hashed token for lookup
   * @param {Object} tokenData - Token metadata (username, expiry, etc.)
   * @returns {Promise<void>}
   */
  async storeToken(tokenHash, tokenData) {
    const key = `${this.prefix}tokens/${tokenHash}.json`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: JSON.stringify({
        ...tokenData,
        stored_at: new Date().toISOString(),
      }),
      ContentType: "application/json",
    });

    await this.s3Client.send(command);
  }

  /**
   * Retrieve token metadata
   * @param {string} tokenHash - Hashed token to look up
   * @returns {Promise<Object|null>} Token data or null if not found/expired
   */
  async getToken(tokenHash) {
    const key = `${this.prefix}tokens/${tokenHash}.json`;

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const response = await this.s3Client.send(command);
      const body = await response.Body.transformToString();
      const tokenData = JSON.parse(body);

      // Check if token is expired
      if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
        // Token expired, delete it
        await this.revokeToken(tokenHash);
        return null;
      }

      return tokenData;
    } catch (error) {
      if (error.name === "NoSuchKey" || error.$metadata?.httpStatusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Revoke/delete an authentication token
   * @param {string} tokenHash - Token hash to revoke
   * @returns {Promise<void>}
   */
  async revokeToken(tokenHash) {
    const key = `${this.prefix}tokens/${tokenHash}.json`;

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.s3Client.send(command);
    } catch (error) {
      // Ignore if already deleted
      if (error.name !== "NoSuchKey" && error.$metadata?.httpStatusCode !== 404) {
        throw error;
      }
    }
  }

  /**
   * Log authentication event for audit trail
   * @param {string} username - User performing the action
   * @param {string} action - Action type (login, logout, failed_login, etc.)
   * @param {Object} metadata - Additional event metadata
   * @returns {Promise<void>}
   */
  async logAuthEvent(username, action, metadata = {}) {
    const timestamp = new Date().toISOString();
    const key = `${this.prefix}audit/${username}/${timestamp}-${action}.json`;

    const auditEntry = {
      username,
      action,
      timestamp,
      ...metadata,
    };

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: JSON.stringify(auditEntry),
      ContentType: "application/json",
    });

    await this.s3Client.send(command);
  }

  /**
   * Get authentication audit trail for a user
   * @param {string} username - Username to get audit trail for
   * @param {number} limit - Maximum number of entries to return
   * @returns {Promise<Array>} Array of audit entries
   */
  async getAuditTrail(username, limit = 100) {
    const prefix = `${this.prefix}audit/${username}/`;

    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
        MaxKeys: limit,
      });

      const response = await this.s3Client.send(command);
      
      if (!response.Contents || response.Contents.length === 0) {
        return [];
      }

      // Fetch each audit entry
      const auditEntries = [];
      for (const item of response.Contents) {
        try {
          const getCommand = new GetObjectCommand({
            Bucket: this.bucket,
            Key: item.Key,
          });

          const obj = await this.s3Client.send(getCommand);
          const body = await obj.Body.transformToString();
          auditEntries.push(JSON.parse(body));
        } catch (error) {
          console.error(`Failed to fetch audit entry ${item.Key}:`, error);
          continue;
        }
      }

      // Sort by timestamp descending (most recent first)
      return auditEntries.sort((a, b) => 
        new Date(b.timestamp) - new Date(a.timestamp)
      );
    } catch (error) {
      console.error("Error fetching audit trail:", error);
      return [];
    }
  }

  /**
   * Clean up expired tokens (maintenance operation)
   * @returns {Promise<number>} Number of tokens cleaned up
   */
  async cleanupExpiredTokens() {
    const prefix = `${this.prefix}tokens/`;
    let cleanedCount = 0;

    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
      });

      const response = await this.s3Client.send(command);
      
      if (!response.Contents || response.Contents.length === 0) {
        return 0;
      }

      const now = new Date();

      for (const item of response.Contents) {
        try {
          const getCommand = new GetObjectCommand({
            Bucket: this.bucket,
            Key: item.Key,
          });

          const obj = await this.s3Client.send(getCommand);
          const body = await obj.Body.transformToString();
          const tokenData = JSON.parse(body);

          // Check if expired
          if (tokenData.expires_at && new Date(tokenData.expires_at) < now) {
            const deleteCommand = new DeleteObjectCommand({
              Bucket: this.bucket,
              Key: item.Key,
            });
            await this.s3Client.send(deleteCommand);
            cleanedCount++;
          }
        } catch (error) {
          console.error(`Failed to process token ${item.Key}:`, error);
          continue;
        }
      }

      return cleanedCount;
    } catch (error) {
      console.error("Error during token cleanup:", error);
      throw error;
    }
  }

  /**
   * Reset all authentication data (for testing/development)
   * WARNING: This deletes all users, tokens, and audit logs
   * @returns {Promise<void>}
   */
  async reset() {
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: this.prefix,
      });

      const response = await this.s3Client.send(command);
      const contents = response.Contents || [];

      for (const item of contents) {
        if (!item.Key) continue;
        
        try {
          const deleteCommand = new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: item.Key,
          });
          await this.s3Client.send(deleteCommand);
        } catch (error) {
          console.error(`Failed to delete auth data ${item.Key}:`, error);
          continue;
        }
      }
    } catch (error) {
      console.error("Error during auth reset:", error);
      throw error;
    }
  }
}

export default S3AuthAdapter;
