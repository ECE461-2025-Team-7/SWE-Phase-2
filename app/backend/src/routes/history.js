//app/backend/src/routes/history.js
import express from "express";
import DataPipeline from "../pipelines/DataPipeline.js";
import { authenticateToken } from "../middleware/authMiddleware.js";

const router = express.Router();
const pipeline = new DataPipeline();

/**
 * GET /artifact/:artifact_type/:id/history
 * Retrieve the complete history of changes to a sensitive artifact
 * 
 * Returns array of history entries:
 * [
 *   {
 *     "timestamp": "2024-12-05T17:30:00Z",
 *     "user": "admin_user",
 *     "action": "CREATE",
 *     "changes": { ... },
 *     "artifact": { "type": "model", "id": "123", "name": "model-name" }
 *   }
 * ]
 */
router.get("/:artifact_type/:id/history", authenticateToken, async (req, res) => {
  try {
    const { artifact_type, id } = req.params;
    const limit = parseInt(req.query.limit) || 100;

    // Validate inputs
    if (!["model", "dataset", "code"].includes(artifact_type)) {
      return res.status(400).json({ 
        error: "Invalid artifact_type. Must be model, dataset, or code." 
      });
    }

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
        name: artifact.metadata?.name
      },
      history,
      count: history.length
    });

  } catch (error) {
    console.error("History retrieval error:", error);
    return res.status(500).json({ error: "Failed to retrieve artifact history." });
  }
});

/**
 * POST /artifact/:artifact_type/:id/history
 * Manually record a history entry (for admin use)
 * 
 * Request body:
 * {
 *   "action": "MANUAL_UPDATE",
 *   "changes": { "field": "value" },
 *   "notes": "Description of changes"
 * }
 */
router.post("/:artifact_type/:id/history", authenticateToken, async (req, res) => {
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
