// app/src/routes/reset.js
import express from "express";
import DataPipeline from "../pipelines/DataPipeline.js";
import { requireAuth, validateResetToken } from "../utils/http-helpers.js";

const router = express.Router();
const pipeline = new DataPipeline();

// DELETE / -> reset registry
// Requires X-Authorization header. Expected token is set via env RESET_TOKEN.
// requireAuth ensures the header is present (403). validateResetToken is a placeholder
// that will eventually check the token value (401). For now it allows the request.
router.delete("/", requireAuth, validateResetToken, async (req, res) => {
    try {
        await pipeline.reset();
        return res.status(200).json({ success: "reset registry" });
    } catch (err) {
        console.error("Reset failed:", err);
        return res.status(500).json({ error: "Failed to reset registry" });
    }
});

export default router;