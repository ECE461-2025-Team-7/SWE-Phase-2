//app/src/middleware/authMiddleware.js
import jwt from "jsonwebtoken";
import S3AuthAdapter from "../adapters/S3AuthAdapter.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("AuthMiddleware");
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-this-in-production";
const authAdapter = new S3AuthAdapter();

/**
 * Middleware to verify JWT token from X-Authorization header
 * 
 * Expected header format: "bearer <token>"
 * 
 * Attaches decoded user information to req.user if valid
 * Tracks token usage and enforces 1000 use limit per project spec
 */
export async function authenticateToken(req, res, next) {
  const authHeader = req.headers["x-authorization"];
  logger.debug("Authenticating request", { method: req.method, path: req.path });

  if (!authHeader) {
    logger.warn("Authentication failed - missing header", { method: req.method, path: req.path });
    return res.status(403).json({ 
      error: "Authentication failed due to invalid or missing AuthenticationToken." 
    });
  }

  // Expected format: "bearer <token>"
  const parts = authHeader.split(" ");
  
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
    logger.warn("Authentication failed - invalid header format", { method: req.method, path: req.path });
    return res.status(403).json({ 
      error: "Authentication failed due to invalid or missing AuthenticationToken." 
    });
  }

  const token = parts[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    logger.debug("JWT verified", { username: decoded.name });
    
    // Track token usage in S3 and enforce limits
    const tokenHash = token.substring(0, 64); // Use first 64 chars as hash
    const updatedTokenData = await authAdapter.incrementTokenUsage(tokenHash);
    
    if (!updatedTokenData) {
      // Token not found, expired, or usage limit exceeded
      logger.warn("Token validation failed", { username: decoded.name });
      return res.status(403).json({ 
        error: "Authentication failed due to invalid or missing AuthenticationToken." 
      });
    }
    
    // Attach user info to request for use in route handlers
    req.user = {
      name: decoded.name,
      is_admin: decoded.is_admin
    };
    
    logger.info("Request authenticated", { username: decoded.name, is_admin: decoded.is_admin, method: req.method, path: req.path });
    next();
  } catch (error) {
    logger.error("Token verification error", { error: error.message, method: req.method, path: req.path });
    return res.status(403).json({ 
      error: "Authentication failed due to invalid or missing AuthenticationToken." 
    });
  }
}

/**
 * Middleware to verify user is an admin
 * Should be used after authenticateToken middleware
 */
export function requireAdmin(req, res, next) {
  if (!req.user || !req.user.is_admin) {
    logger.warn("Admin access denied", { username: req.user?.name, method: req.method, path: req.path });
    return res.status(401).json({ 
      error: "You do not have permission to perform this action." 
    });
  }
  logger.debug("Admin access granted", { username: req.user.name, method: req.method, path: req.path });
  next();
}
