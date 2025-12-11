//app/backend/src/routes/users.js
import express from "express";
import bcrypt from "bcrypt";
import S3AuthAdapter from "../adapters/S3AuthAdapter.js";
import { authenticateToken, requireAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();
const authAdapter = new S3AuthAdapter();

// All user management routes require authentication and admin privileges
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * POST /users
 * Create a new user (admin only)
 * 
 * Request body:
 * {
 *   "username": "newuser",
 *   "password": "strongpassword",
 *   "is_admin": false
 * }
 */
router.post("/", async (req, res) => {
  try {
    const { username, password, is_admin } = req.body;

    // Validate request body
    if (!username || !password || typeof is_admin !== "boolean") {
      return res.status(400).json({ 
        error: "Missing required fields: username, password, and is_admin" 
      });
    }

    // Validate username format (alphanumeric, underscore, hyphen only)
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      return res.status(400).json({ 
        error: "Username can only contain letters, numbers, underscores, and hyphens" 
      });
    }

    // Check if user already exists
    const existingUser = await authAdapter.getUser(username);
    if (existingUser) {
      return res.status(409).json({ 
        error: "User already exists" 
      });
    }

    // Hash password
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    // Create user
    const newUser = await authAdapter.createUser({
      name: username,
      is_admin,
      password_hash
    });

    // Log creation event
    await authAdapter.logAuthEvent(username, "user_created", {
      created_by: req.user.name,
      is_admin
    });

    return res.status(201).json({
      message: "User created successfully",
      user: newUser
    });

  } catch (error) {
    console.error("Error creating user:", error);
    return res.status(500).json({ 
      error: "Failed to create user" 
    });
  }
});

/**
 * GET /users
 * List all users (admin only)
 */
router.get("/", async (req, res) => {
  try {
    const users = await authAdapter.listUsers();
    
    return res.status(200).json({
      users,
      count: users.length
    });

  } catch (error) {
    console.error("Error listing users:", error);
    return res.status(500).json({ 
      error: "Failed to list users" 
    });
  }
});

/**
 * GET /users/:username
 * Get a specific user (admin only)
 */
router.get("/:username", async (req, res) => {
  try {
    const { username } = req.params;

    const user = await authAdapter.getUser(username);
    
    if (!user) {
      return res.status(404).json({ 
        error: "User not found" 
      });
    }

    // Remove password hash from response
    const { password_hash, ...safeUser } = user;

    return res.status(200).json(safeUser);

  } catch (error) {
    console.error("Error fetching user:", error);
    return res.status(500).json({ 
      error: "Failed to fetch user" 
    });
  }
});

/**
 * DELETE /users/:username
 * Delete a user (admin only)
 * Cannot delete the default admin user
 */
router.delete("/:username", async (req, res) => {
  try {
    const { username } = req.params;

    // Prevent deletion of default admin
    if (username === 'ece30861defaultadminuser') {
      return res.status(403).json({ 
        error: "Cannot delete the default admin user" 
      });
    }

    const deleted = await authAdapter.deleteUser(username);
    
    if (!deleted) {
      return res.status(404).json({ 
        error: "User not found" 
      });
    }

    return res.status(200).json({
      message: "User deleted successfully",
      username
    });

  } catch (error) {
    if (error.message.includes('default admin')) {
      return res.status(403).json({ error: error.message });
    }
    console.error("Error deleting user:", error);
    return res.status(500).json({ 
      error: "Failed to delete user" 
    });
  }
});

/**
 * PUT /users/:username
 * Update a user (admin only)
 * Cannot update the default admin user
 * 
 * Request body (all fields optional):
 * {
 *   "password": "newpassword",
 *   "is_admin": true
 * }
 */
router.put("/:username", async (req, res) => {
  try {
    const { username } = req.params;
    const { password, is_admin } = req.body;

    // Prevent modification of default admin
    if (username === 'ece30861defaultadminuser') {
      return res.status(403).json({ 
        error: "Cannot modify the default admin user" 
      });
    }

    // Validate at least one field is provided
    if (password === undefined && is_admin === undefined) {
      return res.status(400).json({ 
        error: "At least one field (password or is_admin) must be provided" 
      });
    }

    const updates = {};

    // Hash new password if provided
    if (password !== undefined) {
      const saltRounds = 10;
      updates.password_hash = await bcrypt.hash(password, saltRounds);
    }

    // Update admin status if provided
    if (is_admin !== undefined) {
      if (typeof is_admin !== "boolean") {
        return res.status(400).json({ 
          error: "is_admin must be a boolean" 
        });
      }
      updates.is_admin = is_admin;
    }

    const updatedUser = await authAdapter.updateUser(username, updates);

    return res.status(200).json({
      message: "User updated successfully",
      user: updatedUser
    });

  } catch (error) {
    if (error.message.includes('default admin')) {
      return res.status(403).json({ error: error.message });
    }
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    console.error("Error updating user:", error);
    return res.status(500).json({ 
      error: "Failed to update user" 
    });
  }
});

export default router;
