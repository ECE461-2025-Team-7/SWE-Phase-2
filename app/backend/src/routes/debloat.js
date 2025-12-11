//app/backend/src/routes/debloat.js
import express from "express";
import { execFile } from "child_process";
import { promisify } from "util";
import DataPipeline from "../pipelines/DataPipeline.js";
import { authenticateToken } from "../middleware/authMiddleware.js";

const router = express.Router();
const pipeline = new DataPipeline();
const execFileAsync = promisify(execFile);

/**
 * POST /artifact/:artifact_type/:id/debloat
 * Upload a JavaScript program that validates artifact download eligibility
 * 
 * Request body:
 * {
 *   "program": "console.log('Checking model...'); process.exit(0);"
 * }
 * 
 * The program should exit with code 0 to allow download, any other code blocks it
 */
router.post("/:artifact_type/:id/debloat", authenticateToken, async (req, res) => {
  try {
    const { artifact_type, id } = req.params;
    const { program } = req.body;

    // Validate inputs
    if (!["model", "dataset", "code"].includes(artifact_type)) {
      return res.status(400).json({ 
        error: "Invalid artifact_type. Must be model, dataset, or code." 
      });
    }

    if (!program || typeof program !== "string") {
      return res.status(400).json({ 
        error: "Missing or invalid 'program' field. Must be a JavaScript string." 
      });
    }

    // Verify artifact exists
    const artifact = await pipeline.getArtifact({ type: artifact_type, id });
    if (!artifact) {
      return res.status(404).json({ error: "Artifact does not exist." });
    }

    // Store the debloat program
    await pipeline.storeDebloatProgram(artifact_type, id, program, req.user.name);

    // Log this action in history
    await pipeline.recordHistory(
      artifact_type,
      id,
      req.user.name,
      "DEBLOAT_UPLOAD",
      { program_length: program.length }
    );

    return res.status(200).json({ 
      message: "Debloat program uploaded successfully",
      artifact_id: id
    });

  } catch (error) {
    console.error("Debloat upload error:", error);
    return res.status(500).json({ error: "Failed to upload debloat program." });
  }
});

/**
 * GET /artifact/:artifact_type/:id/debloat
 * Retrieve the current debloat program for an artifact
 */
router.get("/:artifact_type/:id/debloat", authenticateToken, async (req, res) => {
  try {
    const { artifact_type, id } = req.params;

    // Validate inputs
    if (!["model", "dataset", "code"].includes(artifact_type)) {
      return res.status(400).json({ 
        error: "Invalid artifact_type. Must be model, dataset, or code." 
      });
    }

    // Get the debloat program
    const debloatData = await pipeline.getDebloatProgram(artifact_type, id);
    
    if (!debloatData) {
      return res.status(404).json({ 
        error: "No debloat program found for this artifact." 
      });
    }

    return res.status(200).json(debloatData);

  } catch (error) {
    console.error("Debloat retrieval error:", error);
    return res.status(500).json({ error: "Failed to retrieve debloat program." });
  }
});

/**
 * DELETE /artifact/:artifact_type/:id/debloat
 * Remove the debloat program from an artifact (allows unrestricted download)
 */
router.delete("/:artifact_type/:id/debloat", authenticateToken, async (req, res) => {
  try {
    const { artifact_type, id } = req.params;

    // Validate inputs
    if (!["model", "dataset", "code"].includes(artifact_type)) {
      return res.status(400).json({ 
        error: "Invalid artifact_type. Must be model, dataset, or code." 
      });
    }

    // Delete the debloat program
    const deleted = await pipeline.deleteDebloatProgram(artifact_type, id);
    
    if (!deleted) {
      return res.status(404).json({ 
        error: "No debloat program found for this artifact." 
      });
    }

    // Log this action
    await pipeline.recordHistory(
      artifact_type,
      id,
      req.user.name,
      "DEBLOAT_DELETE",
      {}
    );

    return res.status(200).json({ 
      message: "Debloat program removed successfully" 
    });

  } catch (error) {
    console.error("Debloat deletion error:", error);
    return res.status(500).json({ error: "Failed to delete debloat program." });
  }
});

/**
 * Helper function to execute debloat program
 * Returns true if program exits with code 0, false otherwise
 */
export async function executeDebloatProgram(program, artifactId, artifactType) {
  try {
    // Create a temporary file with the program
    const fs = await import("fs");
    const path = await import("path");
    const os = await import("os");
    
    const tmpDir = os.tmpdir();
    const tmpFile = path.join(tmpDir, `debloat_${artifactId}_${Date.now()}.js`);
    
    // Write program to file
    await fs.promises.writeFile(tmpFile, program, "utf8");
    
    try {
      // Execute with timeout (5 seconds)
      await execFileAsync("node", [tmpFile], {
        timeout: 5000,
        env: {
          ARTIFACT_ID: artifactId,
          ARTIFACT_TYPE: artifactType
        }
      });
      
      // If we get here, exit code was 0
      return true;
      
    } catch (error) {
      // Non-zero exit code or timeout
      console.log(`Debloat program failed for ${artifactId}:`, error.code);
      return false;
      
    } finally {
      // Clean up temp file
      try {
        await fs.promises.unlink(tmpFile);
      } catch (err) {
        console.error("Failed to delete temp file:", err);
      }
    }
    
  } catch (error) {
    console.error("Error executing debloat program:", error);
    return false; // Fail closed - don't allow download on error
  }
}

export default router;
