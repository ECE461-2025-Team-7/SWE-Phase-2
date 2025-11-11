//app/src/routes/authenticate.js
import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import S3AuthAdapter from "../adapters/S3AuthAdapter.js";

const router = express.Router();
const authAdapter = new S3AuthAdapter();

// JWT secret - in production, this should be stored in environment variables
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-this-in-production";
const JWT_EXPIRY = process.env.JWT_EXPIRY || "24h";

/**
 * PUT /authenticate
 * Authenticate user and return JWT token
 * 
 * Request body should contain:
 * {
 *   "user": {
 *     "name": "ece30861defaultadminuser",
 *     "is_admin": true
 *   },
 *   "secret": {
 *     "password": "correcthorsebatterystaple123(!__+@**(A'\"`;DROP TABLE artifacts;"
 *   }
 * }
 */
router.put("/", async (req, res) => {
  try {
    const { user, secret } = req.body;

    // Validate request body structure
    if (!user || !secret) {
      return res.status(400).json({ 
        error: "Missing field(s) in the AuthenticationRequest or it is formed improperly." 
      });
    }

    if (!user.name || typeof user.is_admin !== "boolean") {
      return res.status(400).json({ 
        error: "Missing field(s) in the AuthenticationRequest or it is formed improperly." 
      });
    }

    if (!secret.password) {
      return res.status(400).json({ 
        error: "Missing field(s) in the AuthenticationRequest or it is formed improperly." 
      });
    }

    // Get user from S3
    const storedUser = await authAdapter.getUser(user.name);
    
    if (!storedUser) {
      await authAdapter.logAuthEvent(user.name, "failed_login", { 
        reason: "user_not_found" 
      });
      return res.status(401).json({ 
        error: "The user or password is invalid." 
      });
    }

    // Validate password
    const passwordValid = await bcrypt.compare(secret.password, storedUser.password_hash);
    
    if (!passwordValid || user.is_admin !== storedUser.is_admin) {
      await authAdapter.logAuthEvent(user.name, "failed_login", { 
        reason: "invalid_credentials" 
      });
      return res.status(401).json({ 
        error: "The user or password is invalid." 
      });
    }

    // Generate JWT token
    const tokenPayload = {
      name: user.name,
      is_admin: user.is_admin,
      iat: Math.floor(Date.now() / 1000)
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { 
      expiresIn: JWT_EXPIRY 
    });

    // Store token in S3 for tracking
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    await authAdapter.storeToken(
      token.substring(0, 64), // Use first 64 chars as hash
      {
        username: user.name,
        expires_at: expiresAt.toISOString()
      }
    );

    // Log successful authentication
    await authAdapter.logAuthEvent(user.name, "login");

    // Return token in the format: "bearer <token>"
    const authToken = `bearer ${token}`;
    
    return res.status(200).json(authToken);

  } catch (error) {
    console.error("Authentication error:", error);
    return res.status(400).json({ 
      error: "There is missing field(s) in the AuthenticationRequest or it is formed improperly." 
    });
  }
});

export default router;
