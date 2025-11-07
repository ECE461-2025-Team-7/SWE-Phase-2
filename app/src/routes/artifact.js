// app/src/routes/artifact.js
// This is basically the upload route
import express from "express";
import DataPipeline from "../pipelines/DataPipeline.js";
import { requireAuth, validateArtifactType, validateArtifactBody, parseNameFromUrl } from "../utils/http-helpers.js";

const router = express.Router();
const pipeline = new DataPipeline();

/* 
  POST /artifact/:artifact_type   (BASELINE: create/upload)
  This route allows authenticated users to upload a new artifact of the specified type.
  
  The functions used as middleware before the handler are
  - requireAuth: Ensures the request includes a valid authentication token.
  - validateArtifactType: Validates that the artifact_type parameter is one of the allowed types (model, dataset, code).
  - validateArtifactBody: Validates the request body to ensure it contains a valid URL for the artifact.
  
  Then the handler extracts the artifact_type, url, and name, and uses the 
  pipeline to upload the artifact.
*/
router.post("/:artifact_type", requireAuth, validateArtifactType, validateArtifactBody, async (req, res) => {
  try {
    //Getting the parameters
    const artifact_type = req.params.artifact_type;
    const { url } = req.body || {};
    const name = parseNameFromUrl(url);

    //Upload via pipeline
    const artifact = await pipeline.createArtifact({ type: artifact_type, name, url });
    return res.status(201).json(artifact);
  } 
  catch (err) {     //Catch errors from the pipeline
    if (err?.code === "FORBIDDEN") {
      return res.status(403).json({ error: "Forbidden." });
    }
    if (err?.code === "VALIDATION_ERROR") {
      return res.status(400).json({ error: err.message || "Invalid request." });
    }
    if (err?.code === "ARTIFACT_EXISTS") {
      return res.status(409).json({ error: "Artifact exists already." });
    }
    if (err?.code === "ARTIFACT_DISQUALIFIED") {
      return res.status(424).json({ error: "Artifact not registered due to disqualified rating." });
    }
    console.error("ArtifactCreate error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
