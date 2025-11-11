//app/src/routes/authenticate.js
import express from "express";
import jwt from "jsonwebtoken";

const router = express.Router();

// Default admin credentials from the OpenAPI spec
const DEFAULT_ADMIN = {
  name: "ece30861defaultadminuser",
  is_admin: true,
  password: "correcthorsebatterystaple123(!__+@**(A'\"`;DROP TABLE artifacts;"
};

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
router.put("/", (req, res) => {
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

    // Validate credentials against default admin
    if (user.name !== DEFAULT_ADMIN.name || 
        user.is_admin !== DEFAULT_ADMIN.is_admin ||
        secret.password !== DEFAULT_ADMIN.password) {
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
