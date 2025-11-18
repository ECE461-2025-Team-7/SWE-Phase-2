//app/src/middleware/authMiddleware.js
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-this-in-production";

/**
 * Middleware to verify JWT token from X-Authorization header
 * 
 * Expected header format: "bearer <token>"
 * 
 * Attaches decoded user information to req.user if valid
 */
export function authenticateToken(req, res, next) {
  const authHeader = req.headers["x-authorization"];

  if (!authHeader) {
    return res.status(403).json({ 
      error: "Authentication failed due to invalid or missing AuthenticationToken." 
    });
  }

  // Expected format: "bearer <token>"
  const parts = authHeader.split(" ");
  
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
    return res.status(403).json({ 
      error: "Authentication failed due to invalid or missing AuthenticationToken." 
    });
  }

  const token = parts[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Attach user info to request for use in route handlers
    req.user = {
      name: decoded.name,
      is_admin: decoded.is_admin
    };
    
    next();
  } catch (error) {
    console.error("Token verification error:", error.message);
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
    return res.status(401).json({ 
      error: "You do not have permission to perform this action." 
    });
  }
  next();
}
