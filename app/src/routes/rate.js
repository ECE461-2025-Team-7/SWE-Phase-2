// app/src/routes/rate.js
// Handles model rating retrieval requests
import express from "express";
import RunPipeline from "../pipelines/RunPipeline.js";
import { authenticateToken } from "../middleware/authMiddleware.js";

const router = express.Router();
const pipeline = new RunPipeline();

// GET /artifact/model/:id/rate
router.get("/:id/rate", authenticateToken, async (req, res) => {
  const { id } = req.params || {};
  if (!id) {
    return res.status(400).json({ error: "model id is required" });
  }

  try {
    const rating = await pipeline.executeRun({ id });
    return res.status(200).json(rating);
  } catch (error) {
    console.error("Failed to retrieve rating:", error);
    return res.status(500).json({ error: "failed to retrieve rating" });
  }
});

export default router;