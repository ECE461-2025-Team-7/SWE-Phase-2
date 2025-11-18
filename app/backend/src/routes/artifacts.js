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
router.get("/:artifact_type/:id", requireAuth, validateArtifactType, validateIdParam, async (req, res) => {
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
});

/*
  PUT /artifacts/:artifact_type/:id   (BASELINE: update URL)
  Strict per OpenAPI: Request body must be a full Artifact object.
  - metadata.id and metadata.type must match the path params
  - metadata.name must match the stored artifact's name
  - Only data.url is updated; name and id remain unchanged
*/
router.put("/:artifact_type/:id", requireAuth, validateArtifactType, validateIdParam, async (req, res) => {
  try {
    if (!req.is("application/json")) {
      return res.status(400).json({ error: "Content-Type must be application/json" });
    }

    const body = req.body || {};
    const { metadata, data } = body;
    if (!metadata || typeof metadata !== "object" || !data || typeof data !== "object") {
      return res.status(400).json({ error: "Body must be a valid Artifact with metadata and data" });
    }

    const { artifact_type, id } = req.params;
    const { name, id: bodyId, type: bodyType } = metadata;
    const url = data?.url;

    if (!name || typeof name !== "string") {
      return res.status(400).json({ error: "metadata.name is required" });
    }
    if (!bodyId || typeof bodyId !== "string") {
      return res.status(400).json({ error: "metadata.id is required" });
    }
    if (!bodyType || typeof bodyType !== "string") {
      return res.status(400).json({ error: "metadata.type is required" });
    }
    if (bodyId !== id || bodyType !== artifact_type) {
      return res.status(400).json({ error: "metadata.id and metadata.type must match path parameters" });
    }
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "artifact_data must include a string 'url'" });
    }
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ error: "url must be a valid URI" });
    }

    // Fetch current to verify name is unchanged
    const current = await pipeline.getArtifact({ type: artifact_type, id });
    if (!current) {
      return res.status(404).json({ error: "Artifact does not exist." });
    }
    if (!current?.metadata?.name || current.metadata.name !== name) {
      return res.status(400).json({ error: "metadata.name must match the stored artifact" });
    }

    const updated = await pipeline.updateArtifact({ type: artifact_type, id, url });

    if (!updated) {
      // Adapter signals not found
      return res.status(404).json({ error: "Artifact does not exist." });
    }
    if (!validateArtifactShape(updated)) {
      console.error("Artifact updated is malformed:", updated);
      return res.status(400).json({ error: "Internal server error" });
    }
    return res.sendStatus(200);
  } catch (err) {
    if (err?.code === "FORBIDDEN") {
      return res.status(403).json({ error: "Forbidden." });
    }
    if (err?.code === "VALIDATION_ERROR") {
      return res.status(400).json({ error: err.message || "Invalid request." });
    }
    if (err?.code === "NOT_FOUND") {
      return res.status(404).json({ error: "Artifact does not exist." });
    }
    console.error("ArtifactUpdate error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
