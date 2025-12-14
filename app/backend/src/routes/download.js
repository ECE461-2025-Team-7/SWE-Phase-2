// app/backend/src/routes/download.js
import express from "express";
import DataPipeline from "../pipelines/DataPipeline.js";
// Optional: enforce auth on downloads. Uncomment if desired.
// import { authenticateToken } from "../middleware/authMiddleware.js";

const router = express.Router();
const pipeline = new DataPipeline();

// GET /download/:artifact_type/:id
router.get("/:artifact_type/:id"/*, authenticateToken*/, async (req, res) => {
  const { artifact_type, id } = req.params;

  // Lookup the artifact (auth already enforced upstream for the artifact GET path)
  const artifact = await pipeline.getArtifact({ type: artifact_type, id });
  if (!artifact) {
    return res.status(404).json({ error: "Artifact does not exist." });
  }

  // Fetch a stream for the bundle
  try {
    const bundle = await pipeline.getBundleStream(artifact_type, id);
    if (!bundle) {
      return res.status(404).json({ error: "Bundle not found." });
    }

    res.setHeader("Content-Type", bundle.contentType || "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${bundle.filename || `${id}.zip`}"`
    );

    return bundle.stream.pipe(res);
  } catch (err) {
    console.error("Bundle download failed:", err);
    return res.status(500).json({ error: "Failed to download bundle." });
  }
});

export default router;
