//app/backend/src/routes/cost.js
import express from "express";
import DataPipeline from "../pipelines/DataPipeline.js";
import { authenticateToken } from "../middleware/authMiddleware.js";

const router = express.Router();
const pipeline = new DataPipeline();

/**
 * GET /artifact/:artifact_type/:id/cost?dependency=true
 * Calculate the cost (size in MB) of an artifact and optionally its dependencies
 * 
 * Query params:
 * - dependency: boolean (default false) - include dependency costs
 * 
 * Returns:
 * {
 *   "artifact_id": {
 *     "standalone_cost": 412.5,  // only if dependency=true
 *     "total_cost": 1255.0
 *   },
 *   "dep_id_1": { ... },  // only if dependency=true
 *   ...
 * }
 */
router.get("/:artifact_type/:id/cost", authenticateToken, async (req, res) => {
  try {
    const { artifact_type, id } = req.params;
    const includeDependencies = req.query.dependency === "true";

    // Validate artifact type
    if (!["model", "dataset", "code"].includes(artifact_type)) {
      return res.status(400).json({ 
        error: "Invalid artifact_type. Must be model, dataset, or code." 
      });
    }

    // Get the artifact
    const artifact = await pipeline.getArtifact({ type: artifact_type, id });
    if (!artifact) {
      return res.status(404).json({ error: "Artifact does not exist." });
    }

    // Calculate costs
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

      // Estimate size (in reality, this would come from S3 metadata or artifact data)
      // For now, use a simple estimation based on artifact type
      let size = estimateArtifactSize(art);

      // Add to result
      if (includeDependencies) {
        costResult[artId] = {
          standalone_cost: size,
          total_cost: size // Will be updated with dependencies
        };
      }

      // Find dependencies
      const deps = extractDependencies(art);
      let depCost = 0;

      for (const dep of deps) {
        depCost += await calculateCost(dep.id, dep.type);
      }

      // Update total cost to include dependencies
      if (includeDependencies && costResult[artId]) {
        costResult[artId].total_cost += depCost;
      }

      return size + depCost;
    }

    const totalCost = await calculateCost(id, artifact_type);

    // Format response
    if (!includeDependencies) {
      // Simple response: just total cost
      return res.status(200).json({
        [id]: {
          total_cost: totalCost
        }
      });
    }

    // With dependencies: return all artifacts
    return res.status(200).json(costResult);

  } catch (error) {
    console.error("Cost calculation error:", error);
    return res.status(500).json({ 
      error: "The artifact cost calculator encountered an error." 
    });
  }
});

/**
 * Estimate artifact size in MB
 * In production, this would fetch actual size from S3 metadata
 */
function estimateArtifactSize(artifact) {
  // Simple estimation based on type
  // In reality, use S3 HeadObject to get ContentLength
  const type = artifact.metadata?.type;
  
  if (type === "model") {
    return 500 + Math.random() * 1000; // 500-1500 MB
  } else if (type === "dataset") {
    return 200 + Math.random() * 800; // 200-1000 MB
  } else if (type === "code") {
    return 10 + Math.random() * 90; // 10-100 MB
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
  const data = artifact.data || {};
  
  // Example: extract from metadata (would be populated during ingestion)
  if (metadata.base_model) {
    deps.push({ id: metadata.base_model, type: "model" });
  }
  
  if (metadata.datasets && Array.isArray(metadata.datasets)) {
    metadata.datasets.forEach(ds => {
      deps.push({ id: ds, type: "dataset" });
    });
  }
  
  if (metadata.dependencies && Array.isArray(metadata.dependencies)) {
    metadata.dependencies.forEach(dep => {
      deps.push({ 
        id: dep.id || dep, 
        type: dep.type || "code" 
      });
    });
  }
  
  return deps;
}

export default router;
