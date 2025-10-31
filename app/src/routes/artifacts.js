//app/src/routes/artifacts.js
//This is basically the download route
import express from "express";
import DataPipeline from "../pipelines/DataPipeline.js";
import { requireAuth, validateArtifactType, validateIdParam } from "../utils/http-helpers.js";

const router = express.Router();
const pipeline = new DataPipeline();

// GET /artifacts/:artifact_type/:id   (BASELINE: retrieve/download)
router.get("/:artifact_type/:id", requireAuth, validateArtifactType, validateIdParam, async (req, res) => {
  try {
    const { artifact_type, id } = req.params;
    const artifact = await pipeline.getArtifact({ type: artifact_type, id });
    if (!artifact) {
      return res.status(404).json({ error: "Artifact does not exist." });
    }
    // Spec: 200 with Artifact { metadata:{name,id,type}, data:{url} }
    return res.status(200).json(artifact);
  } catch (err) {
    console.error("ArtifactRetrieve error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
