//app/backend/src/routes/lineage.js
import express from "express";
import DataPipeline from "../pipelines/DataPipeline.js";
import { authenticateToken } from "../middleware/authMiddleware.js";

const router = express.Router();
const pipeline = new DataPipeline();

/**
 * GET /artifact/model/:id/lineage
 * Retrieve the lineage graph for a model artifact
 * 
 * Returns:
 * {
 *   "nodes": [
 *     {
 *       "artifact_id": "123",
 *       "name": "model-name",
 *       "source": "config_json",
 *       "metadata": { ... }
 *     }
 *   ],
 *   "edges": [
 *     {
 *       "from_node_artifact_id": "456",
 *       "to_node_artifact_id": "123",
 *       "relationship": "base_model"
 *     }
 *   ]
 * }
 */
router.get("/:id/lineage", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Get the model artifact
    const artifact = await pipeline.getArtifact({ type: "model", id });
    if (!artifact) {
      return res.status(404).json({ error: "Artifact does not exist." });
    }

    // Build lineage graph
    const nodes = [];
    const edges = [];
    const visited = new Set(); // Avoid cycles

    // Recursive function to build lineage
    async function buildLineage(artId, artType, source = "root") {
      if (visited.has(artId)) {
        return;
      }
      visited.add(artId);

      const art = await pipeline.getArtifact({ type: artType, id: artId });
      if (!art) {
        return;
      }

      // Add node
      nodes.push({
        artifact_id: artId,
        name: art.metadata?.name || "unknown",
        source: source,
        metadata: {
          type: artType,
          url: art.data?.url
        }
      });

      // Extract dependencies and create edges
      const deps = extractLineageDependencies(art);
      
      for (const dep of deps) {
        // Add edge from dependency to current artifact
        edges.push({
          from_node_artifact_id: dep.id,
          to_node_artifact_id: artId,
          relationship: dep.relationship
        });

        // Recursively process dependency
        await buildLineage(dep.id, dep.type, dep.source);
      }
    }

    // Start building from the requested artifact
    await buildLineage(id, "model", "requested");

    // Check if we found any lineage
    if (nodes.length === 0) {
      return res.status(400).json({ 
        error: "The lineage graph cannot be computed because the artifact metadata is missing or malformed." 
      });
    }

    return res.status(200).json({
      nodes,
      edges
    });

  } catch (error) {
    console.error("Lineage calculation error:", error);
    return res.status(400).json({ 
      error: "The lineage graph cannot be computed because the artifact metadata is missing or malformed." 
    });
  }
});

/**
 * Extract lineage dependencies from artifact metadata
 * Looks for parent models, base models, datasets, etc.
 */
function extractLineageDependencies(artifact) {
  const deps = [];
  const metadata = artifact.metadata || {};
  
  // Base model (common in HuggingFace models)
  if (metadata.base_model) {
    deps.push({
      id: metadata.base_model,
      type: "model",
      relationship: "base_model",
      source: "config_json"
    });
  }

  // Parent model
  if (metadata.parent_model) {
    deps.push({
      id: metadata.parent_model,
      type: "model",
      relationship: "parent_model",
      source: "config_json"
    });
  }

  // Fine-tuning dataset
  if (metadata.finetune_dataset) {
    deps.push({
      id: metadata.finetune_dataset,
      type: "dataset",
      relationship: "fine_tuning_dataset",
      source: "config_json"
    });
  }

  // Training datasets
  if (metadata.datasets && Array.isArray(metadata.datasets)) {
    metadata.datasets.forEach(ds => {
      deps.push({
        id: ds.id || ds,
        type: "dataset",
        relationship: "training_dataset",
        source: "model_card"
      });
    });
  }

  // Code dependencies
  if (metadata.code_dependencies && Array.isArray(metadata.code_dependencies)) {
    metadata.code_dependencies.forEach(code => {
      deps.push({
        id: code.id || code,
        type: "code",
        relationship: "code_dependency",
        source: "requirements"
      });
    });
  }

  // Generic dependencies field
  if (metadata.dependencies && Array.isArray(metadata.dependencies)) {
    metadata.dependencies.forEach(dep => {
      deps.push({
        id: dep.id || dep,
        type: dep.type || "model",
        relationship: dep.relationship || "dependency",
        source: dep.source || "metadata"
      });
    });
  }

  return deps;
}

export default router;
