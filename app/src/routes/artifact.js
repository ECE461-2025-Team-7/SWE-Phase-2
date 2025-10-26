//app/src/routes/artifact.js
//This is basically the upload route
import express from "express";
import DataPipeline from "../pipelines/DataPipeline.js";
import { requireAuth, validateArtifactType, parseNameFromUrl } from "../utils/http-helpers.js";

const router = express.Router();
const pipeline = new DataPipeline();

// POST /artifact/:artifact_type   (BASELINE: create/upload)
router.post("/:artifact_type", requireAuth, validateArtifactType, async (req, res) => {
  try {
    if (!req.is("application/json")) {
      return res.status(400).json({ error: "Content-Type must be application/json" });
    }
    const { url } = req.body || {};
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "artifact_data must include a string 'url'" });
    }
    // OpenAPI: url must be a valid URI
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ error: "url must be a valid URI" });
    }

    const artifact_type = req.params.artifact_type; // 'model' | 'dataset' | 'code'
    const name = parseNameFromUrl(url);

    // Create in registry via data pipeline (handles id generation + conflict check)
    const artifact = await pipeline.createArtifact({ type: artifact_type, name, url });

    // Spec: 201 with Artifact { metadata:{name,id,type}, data:{url} }
    return res.status(201).json(artifact);
  } catch (err) {
    if (err?.code === "ARTIFACT_EXISTS") {
      return res.status(409).json({ error: "Artifact exists already." });
    }
    if (err?.code === "ARTIFACT_DISQUALIFIED") {
      // If/when you hook rating gate here, 424 is in the spec for disqualified rating
      return res.status(424).json({ error: "Artifact not registered due to disqualified rating." });
    }
    console.error("ArtifactCreate error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;