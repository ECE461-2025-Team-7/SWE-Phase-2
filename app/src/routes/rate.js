// app/src/routes/rate.js
// Handles model rating retrieval requests
import express from "express";
import RunPipeline from "../pipelines/RunPipeline.js";

const router = express.Router();
const pipeline = new RunPipeline();

// GET /artifact/model/:id/rate
router.get("/:id/rate", async (req, res) => {
  const { id } = req.params || {};
  if (!id) {
    return res.status(400).json({ error: "model id is required" });
  }

  const authToken = req.header("X-Authorization");
  if (!authToken) {
    return res.status(403).json({ error: "missing authentication token" });
  }

  try {
    const rating = await pipeline.executeRun({ id, authToken });
    return res.status(200).json(rating);
  } catch (error) {
    console.error("Failed to retrieve rating:", error);
    return res.status(500).json({ error: "failed to retrieve rating" });
  }
});

export default router;
