// app/src/routes/rate.js
// Handles model rating retrieval requests
import express from "express";
import RunPipeline from "../pipelines/RunPipeline.js";
import { requireAuth, validateIdParam } from "../utils/http-helpers.js";

const router = express.Router();
const pipeline = new RunPipeline();

// GET /artifact/model/:id/rate
router.get("/:id/rate", requireAuth, validateIdParam, async (req, res) => {
  const { id } = req.params;

  try {
    const rating = await pipeline.executeRun({ id });
    return res.status(200).json(rating);
  } catch (error) {
    // Map pipeline errors to OpenAPI responses
    if (error?.code === "NOT_FOUND") {
      return res.status(404).json({ error: "Artifact does not exist." });
    }
    if (error?.code === "VALIDATION_ERROR") {
      return res.status(400).json({ error: error.message || "Invalid request." });
    }

    console.error("Failed to retrieve rating:", error);
    return res.status(500).json({
      error:
        "The artifact rating system encountered an error while computing at least one metric.",
    });
  }
});

export default router;
