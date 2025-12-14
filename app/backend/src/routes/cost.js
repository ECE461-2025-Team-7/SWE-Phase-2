//app/backend/src/routes/cost.js
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
 * GET /artifact/:artifact_type/:id/cost?dependency=true
 * Calculate the cost (size in MB) of an artifact and optionally its dependencies
 */
router.get(
  "/:artifact_type/:id/cost",
  requireAuth,
  validateArtifactType,
  validateIdParam,
  async (req, res) => {
    try {
      const { artifact_type, id } = req.params;
      const includeDependencies = req.query.dependency === "true";

      // Get the artifact
      const artifact = await pipeline.getArtifact({ type: artifact_type, id });
      if (!artifact) {
        return res.status(404).json({ error: "Artifact does not exist." });
      }

      // If dependency=false, return the standalone cost of the requested artifact only.
      // (Do not include dependencies in this mode per OpenAPI schema description.)
      if (!includeDependencies) {
        const standalone = estimateArtifactSize(artifact);
        return res.status(200).json({
          [id]: {
            total_cost: standalone,
          },
        });
      }

      // dependency=true: return per-artifact costs including dependencies.
      const costResult = {};
      const visited = new Set(); // Track visited artifacts to avoid cycles

      // Recursive function to calculate artifact cost
      async function calculateCost(artId, artType) {
        if (visited.has(artId)) {
          return 0; // Already counted
        }
        visited.add(artId);

        const art = await pipeline.getArtifact({ type: artType, id: artId });
        if (!art) {
          return 0;
        }

        const size = estimateArtifactSize(art);

        // Add to result
        costResult[artId] = {
          standalone_cost: size,
          total_cost: size, // Will be updated with dependencies
        };

        // Find dependencies
        const deps = extractDependencies(art);
        let depCost = 0;

        for (const dep of deps) {
          depCost += await calculateCost(dep.id, dep.type);
        }

        // Update total cost to include dependencies
        costResult[artId].total_cost += depCost;

        return size + depCost;
      }

      await calculateCost(id, artifact_type);

      // With dependencies: return all artifacts
      return res.status(200).json(costResult);
    } catch (error) {
      console.error("Cost calculation error:", error);
      return res.status(500).json({
        error: "The artifact cost calculator encountered an error.",
      });
    }
  },
);

/**
 * Estimate artifact size in MB
 * In production, this would fetch actual size from S3 metadata
 */
function estimateArtifactSize(artifact) {
  // NOTE: This is a deterministic placeholder.
  // In a full implementation, use S3 HeadObject (ContentLength) for the stored bundle.
  const type = artifact.metadata?.type;
  const id = String(artifact.metadata?.id || "");

  // Stable hash -> [0,1)
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const unit = (h >>> 0) / 4294967295;

  if (type === "model") {
    return 500 + unit * 1000; // 500-1500 MB
  } else if (type === "dataset") {
    return 200 + unit * 800; // 200-1000 MB
  } else if (type === "code") {
    return 10 + unit * 90; // 10-100 MB
  }

  return 100; // Default
}

/**
 * Extract dependencies from artifact metadata
 * Looks for base_model, datasets, parent models, etc.
 */
function extractDependencies(artifact) {
  const deps = [];

  // Check metadata for dependency information
  // This would parse config.json, model_index.json, etc.
  const metadata = artifact.metadata || {};

  // Example: extract from metadata (would be populated during ingestion)
  if (metadata.base_model) {
    deps.push({ id: metadata.base_model, type: "model" });
  }

  if (metadata.datasets && Array.isArray(metadata.datasets)) {
    metadata.datasets.forEach((ds) => {
      deps.push({ id: ds, type: "dataset" });
    });
  }

  if (metadata.dependencies && Array.isArray(metadata.dependencies)) {
    metadata.dependencies.forEach((dep) => {
      deps.push({
        id: dep.id || dep,
        type: dep.type || "code",
      });
    });
  }

  return deps;
}

export default router;
