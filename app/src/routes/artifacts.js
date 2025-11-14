//app/src/routes/artifacts.js
//This is basically the download route
import express from "express";
import DataPipeline from "../pipelines/DataPipeline.js";
import { requireAuth, validateArtifactType, validateIdParam, validateArtifactShape } from "../utils/http-helpers.js";

const router = express.Router();
const pipeline = new DataPipeline();

/*
  GET /artifacts/:artifact_type/:id   (BASELINE: retrieve/download)
  This route allows authenticated users to retrieve an artifact by its type and id.
  
  The functions used as middleware before the handler are
  - requireAuth: Ensures the request includes a valid authentication token.
  - validateArtifactType: Validates that the artifact_type parameter is one of the allowed types (model, dataset, code).
  - validateIdParam: Validates the id parameter to ensure it meets the expected format.
  
  Then the handler extracts the artifact_type and id, and uses the 
  pipeline to retrieve the artifact.
*/
export async function getArtifactHandler(req, res) {
  try {
    //Getting the parameters
    const { artifact_type, id } = req.params;

    //Retrieve via pipeline
    const artifact = await pipeline.getArtifact({ type: artifact_type, id });

    //Checking on server side
    if (!artifact) {
      return res.status(404).json({ error: "Artifact does not exist." });
    }
    if (!validateArtifactShape(artifact)) {
      console.error("Artifact retrieved is malformed:", artifact);
      return res.status(400).json({ error: "Internal server error" });
    }
    
    //Return the artifact after the checks
    return res.status(200).json(artifact);
  } 
  catch (err) {     //Catch errors from the pipeline
    if (err?.code === "FORBIDDEN") {
      return res.status(403).json({ error: "Forbidden." });
    }
    if (err?.code === "VALIDATION_ERROR") {
      return res.status(400).json({ error: err.message || "Invalid request." });
    }
    if (err?.code === "NOT_FOUND") {
      return res.status(404).json({ error: "Artifact does not exist." });
    }
    console.error("ArtifactRetrieve error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

router.get("/:artifact_type/:id", requireAuth, validateArtifactType, validateIdParam, getArtifactHandler);

export default router;
