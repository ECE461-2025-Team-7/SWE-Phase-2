//app/src/routes/artifacts.js
//This is basically the download route
import express from "express";
import DataPipeline from "../pipelines/DataPipeline.js";
import { requireAuth, validateArtifactType, validateIdParam, validateArtifactShape, validateArtifactQueriesBody, parseOffset } from "../utils/http-helpers.js";
import { executeDebloatProgram } from "./debloat.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("ArtifactsRoute");
const router = express.Router();
const pipeline = new DataPipeline();

/*
  POST /artifacts   (BASELINE: list/search)
  Body: array of ArtifactQuery objects. Supports wildcard name "*".
  Optional query param: offset (string integer) for pagination.
  Returns array of ArtifactMetadata and offset header when more results exist.
*/
router.post("/", requireAuth, validateArtifactQueriesBody, parseOffset, async (req, res) => {
  try {
    const offset = req.offset ?? 0;
    console.log("[ARTIFACTS_SEARCH] POST /artifacts called", { 
      body: req.body, 
      offset, 
      username: req.user?.name 
    });
    logger.info("Searching artifacts", { queryCount: req.body?.length, offset, username: req.user?.name });
    const { artifacts, nextOffset } = await pipeline.searchArtifacts(req.body, offset);
    logger.info("Artifacts search completed", { resultCount: artifacts.length, hasMore: nextOffset !== null });
    console.log("[ARTIFACTS_SEARCH] Search completed", { resultCount: artifacts.length });
    if (nextOffset !== null && nextOffset !== undefined) {
      res.set("offset", String(nextOffset));
    }
    return res.status(200).json(artifacts);
  } catch (err) {
    console.error("[ARTIFACTS_SEARCH] Error:", {
      error: err.message,
      body: req.body,
      username: req.user?.name
    });
    logger.error("Artifact search error", { error: err.message, username: req.user?.name });
    return res.status(500).json({ error: "Internal server error" });
  }
});

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
    logger.info("Retrieving artifact", { type: artifact_type, id, username: req.user?.name });

    //Retrieve via pipeline
    const artifact = await pipeline.getArtifact({ type: artifact_type, id });

    //Checking on server side
    if (!artifact) {
      logger.warn("Artifact not found", { type: artifact_type, id });
      return res.status(404).json({ error: "Artifact does not exist." });
    }
    if (!validateArtifactShape(artifact)) {
      logger.error("Artifact malformed", { type: artifact_type, id, artifact });
      return res.status(400).json({ error: "Internal server error" });
    }
    
    // Check for debloat program validation
    const debloatData = await pipeline.getDebloatProgram(artifact_type, id);
    if (debloatData && debloatData.program) {
      logger.info("Executing debloat program", { type: artifact_type, id });
      const isValid = await executeDebloatProgram(
        debloatData.program, 
        id, 
        artifact_type
      );
      
      if (!isValid) {
        logger.warn("Debloat validation failed", { type: artifact_type, id });
        return res.status(403).json({ 
          error: "Download blocked: artifact failed debloat validation program." 
        });
      }
      logger.info("Debloat validation passed", { type: artifact_type, id });
    }
    
    //Return the artifact after the checks
    logger.info("Artifact retrieved successfully", { type: artifact_type, id });
    return res.status(200).json(artifact);
  } 
  catch (err) {     //Catch errors from the pipeline
    if (err?.code === "FORBIDDEN") {
      logger.warn("Artifact retrieve forbidden", { type: req.params.artifact_type, id: req.params.id });
      return res.status(403).json({ error: "Forbidden." });
    }
    if (err?.code === "VALIDATION_ERROR") {
      logger.warn("Artifact retrieve validation error", { error: err.message });
      return res.status(400).json({ error: err.message || "Invalid request." });
    }
    if (err?.code === "NOT_FOUND") {
      logger.warn("Artifact not found", { type: req.params.artifact_type, id: req.params.id });
      return res.status(404).json({ error: "Artifact does not exist." });
    }
    logger.error("Artifact retrieve error", { error: err.message, type: req.params.artifact_type, id: req.params.id });
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
    const { artifact_type, id } = req.params;
    logger.info("Updating artifact", { type: artifact_type, id, username: req.user?.name });
    
    if (!req.is("application/json")) {
      logger.warn("Invalid content type for artifact update", { type: artifact_type, id });
      return res.status(400).json({ error: "Content-Type must be application/json" });
    }

    const body = req.body || {};
    const { metadata, data } = body;
    if (!metadata || typeof metadata !== "object" || !data || typeof data !== "object") {
      return res.status(400).json({ error: "Body must be a valid Artifact with metadata and data" });
    }

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
      logger.error("Updated artifact malformed", { type: artifact_type, id, updated });
      return res.status(400).json({ error: "Internal server error" });
    }
    
    // Record history for artifact update
    try {
      await pipeline.recordHistory(
        artifact_type,
        id,
        req.user.name,
        "ARTIFACT_UPDATED",
        { old_url: current.data.url, new_url: url }
      );
    } catch (histErr) {
      logger.error("Failed to record history", { error: histErr.message, type: artifact_type, id });
      // Don't fail the request if history recording fails
    }
    
    logger.info("Artifact updated successfully", { type: artifact_type, id });
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

/*
  DELETE /artifacts/:artifact_type/:id   (NON-BASELINE: delete artifact)
  This route allows authenticated users to delete an artifact by its type and id.
  
  The functions used as middleware before the handler are:
  - requireAuth: Ensures the request includes a valid authentication token.
  - validateArtifactType: Validates that the artifact_type parameter is one of the allowed types (model, dataset, code).
  - validateIdParam: Validates the id parameter to ensure it meets the expected format.
  
  Then the handler extracts the artifact_type and id, and uses the 
  pipeline to delete the artifact.
*/
router.delete("/:artifact_type/:id", requireAuth, validateArtifactType, validateIdParam, async (req, res) => {
  try {
    const { artifact_type, id } = req.params;
    logger.info("Deleting artifact", { type: artifact_type, id, username: req.user?.name });

    // Get artifact info before deletion for history
    const artifact = await pipeline.getArtifact({ type: artifact_type, id });

    // Delete via pipeline
    const deleted = await pipeline.deleteArtifact({ type: artifact_type, id });

    // If artifact was not found, return 404
    if (!deleted) {
      logger.warn("Artifact not found for deletion", { type: artifact_type, id });
      return res.status(404).json({ error: "Artifact does not exist." });
    }
    
    // Record history for artifact deletion
    if (artifact) {
      try {
        await pipeline.recordHistory(
          artifact_type,
          id,
          req.user.name,
          "ARTIFACT_DELETED",
          { name: artifact.metadata?.name, url: artifact.data?.url }
        );
      } catch (histErr) {
        logger.error("Failed to record history", { error: histErr.message, type: artifact_type, id });
        // Don't fail the request if history recording fails
      }
    }

    // Return 200 on successful deletion
    logger.info("Artifact deleted successfully", { type: artifact_type, id });
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
    console.error("ArtifactDelete error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
