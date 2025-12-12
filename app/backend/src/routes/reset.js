// app/src/routes/reset.js
import express from "express";
import DataPipeline from "../pipelines/DataPipeline.js";
import S3AuthAdapter from "../adapters/S3AuthAdapter.js";
import { requireAuth, validateResetToken } from "../utils/http-helpers.js";
import { createLogger } from "../utils/logger.js";
import bcrypt from "bcrypt";

const logger = createLogger("ResetRoute");
const router = express.Router();
const pipeline = new DataPipeline();
const authAdapter = new S3AuthAdapter();

// Default admin user credentials
const DEFAULT_ADMIN = {
  name: 'ece30861defaultadminuser',
  is_admin: true,
  password: "correcthorsebatterystaple123(!__+@**(A'\"`; DROP TABLE packages;"
};

// DELETE / -> reset registry
// Requires X-Authorization header. Expected token is set via env RESET_TOKEN.
// requireAuth ensures the header is present (403). validateResetToken is a placeholder
// that will eventually check the token value (401). For now it allows the request.
router.delete("/", requireAuth, validateResetToken, async (req, res) => {
    try {
        logger.warn("Starting registry reset", { username: req.user?.name });
        
        // Reset artifacts (models, datasets, code)
        logger.info("Resetting artifacts");
        await pipeline.reset();
        logger.info("Artifacts reset complete");
        
        // Reset authentication data (users, tokens, audit logs)
        // Note: This deletes the token being used for this request!
        logger.info("Resetting authentication data");
        await authAdapter.reset();
        logger.info("Authentication data reset complete");
        
        // Recreate default admin user (pristine/initial state)
        logger.info("Recreating default admin user");
        const saltRounds = 10;
        const password_hash = await bcrypt.hash(DEFAULT_ADMIN.password, saltRounds);
        
        await authAdapter.createUser({
            name: DEFAULT_ADMIN.name,
            is_admin: DEFAULT_ADMIN.is_admin,
            password_hash: password_hash
        });
        logger.info("Default admin user recreated", { username: DEFAULT_ADMIN.name });
        
        logger.warn("Registry reset completed successfully");
        return res.status(200).json({ message: "Registry is reset." });
    } catch (err) {
        logger.error("Reset failed", { error: err.message, stack: err.stack });
        return res.status(500).json({ error: "Failed to reset registry" });
    }
});

export default router;