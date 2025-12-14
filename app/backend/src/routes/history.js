//app/backend/src/routes/history.js
import express from "express";
import DataPipeline from "../pipelines/DataPipeline.js";
import {
  requireAuth,
  validateArtifactType,
  validateIdParam,
} from "../utils/http-helpers.js";

const router = express.Router();
const pipeline = new DataPipeline();

/**
 * GET /artifact/:artifact_type/:id/audit (NON-BASELINE)
 * Return an audit trail for this artifact.
 * Minimal implementation backed by the history store.
 */
router.get(
  "/:artifact_type/:id/audit",
  requireAuth,
  validateArtifactType,
  validateIdParam,
  async (req, res) => {
    try {
      const { artifact_type, id } = req.params;

      const artifact = await pipeline.getArtifact({ type: artifact_type, id });
      if (!artifact) {
        return res.status(404).json({ error: "Artifact does not exist." });
      }

      // Best-effort: translate internal history entries to the OpenAPI audit schema.
      const history = await pipeline.getArtifactHistory(artifact_type, id, 500);
      const audit = (history || []).map((h) => {
        const action = String(h.action || "AUDIT");
        const mappedAction = action.includes("CREATED")
          ? "CREATE"
          : action.includes("UPDATED")
            ? "UPDATE"
            : action.includes("DOWNLOADED")
              ? "DOWNLOAD"
              : action.includes("RATE")
                ? "RATE"
                : "AUDIT";

        return {
          user: {
            name: String(h.user || "unknown"),
            is_admin: false,
          },
          date: h.timestamp || new Date().toISOString(),
          artifact: {
            name: artifact.metadata?.name || "unknown",
            id,
            type: artifact_type,
          },
          action: mappedAction,
        };
      });

      return res.status(200).json(audit);
    } catch (error) {
      console.error("Audit retrieval error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  },
);

/**
 * GET /artifact/:artifact_type/:id/history
 * Retrieve the complete history of changes to a sensitive artifact
 */
router.get(
  "/:artifact_type/:id/history",
  requireAuth,
  validateArtifactType,
  validateIdParam,
  async (req, res) => {
    try {
      const { artifact_type, id } = req.params;
      const limit = parseInt(req.query.limit) || 100;

      // Verify artifact exists
      const artifact = await pipeline.getArtifact({ type: artifact_type, id });
      if (!artifact) {
        return res.status(404).json({ error: "Artifact does not exist." });
      }

      // Get history
      const history = await pipeline.getArtifactHistory(artifact_type, id, limit);

      return res.status(200).json({
        artifact: {
          id,
          type: artifact_type,
          name: artifact.metadata?.name,
        },
        history,
        count: history.length,
      });
    } catch (error) {
      console.error("History retrieval error:", error);
      return res.status(500).json({ error: "Failed to retrieve artifact history." });
    }
  },
);

/**
 * POST /artifact/:artifact_type/:id/history
 * Manually record a history entry (for admin use)
 */
router.post(
  "/:artifact_type/:id/history",
  requireAuth,
  validateArtifactType,
  validateIdParam,
  async (req, res) => {
  try {
    const { artifact_type, id } = req.params;
    const { action, changes, notes } = req.body;

    // Validate inputs
    if (!["model", "dataset", "code"].includes(artifact_type)) {
      return res.status(400).json({ 
        error: "Invalid artifact_type. Must be model, dataset, or code." 
      });
    }

    if (!action || typeof action !== "string") {
      return res.status(400).json({ 
        error: "Missing or invalid 'action' field." 
      });
    }

    // Verify artifact exists
    const artifact = await pipeline.getArtifact({ type: artifact_type, id });
    if (!artifact) {
      return res.status(404).json({ error: "Artifact does not exist." });
    }

    // Record history
    await pipeline.recordHistory(
      artifact_type,
      id,
      req.user.name,
      action,
      {
        changes: changes || {},
        notes: notes || "",
        manual: true
      }
    );

    return res.status(201).json({ 
      message: "History entry recorded successfully" 
    });

  } catch (error) {
    console.error("History recording error:", error);
    return res.status(500).json({ error: "Failed to record history entry." });
  }
});

export default router;
