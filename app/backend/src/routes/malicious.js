//app/backend/src/routes/malicious.js
import express from "express";
import DataPipeline from "../pipelines/DataPipeline.js";
import { authenticateToken } from "../middleware/authMiddleware.js";

const router = express.Router();
const pipeline = new DataPipeline();

// Suspicious patterns to check
const SUSPICIOUS_DOMAINS = [
  "pastebin.com",
  "bit.ly",
  "tinyurl.com",
  "dropbox.com/s/", // public dropbox links
  "drive.google.com", // public drive links
  "temp-share",
  "tempfile"
];

const SUSPICIOUS_PATTERNS = [
  /eval\(/gi,
  /exec\(/gi,
  /system\(/gi,
  /subprocess/gi,
  /shell=true/gi,
  /base64\.b64decode/gi,
  /pickle\.loads/gi
];

/**
 * GET /artifact/malicious
 * Returns a list of artifacts suspected to be malicious
 * 
 * Query params:
 * - threshold: number (0-1) - suspicion threshold (default 0.5)
 * - limit: number - max results to return (default 50)
 * 
 * Returns:
 * [
 *   {
 *     "artifact_id": "123",
 *     "artifact_type": "model",
 *     "name": "suspicious-model",
 *     "suspicion_score": 0.75,
 *     "reasons": ["Low trust score", "Suspicious URL domain"]
 *   }
 * ]
 */
router.get("/", authenticateToken, async (req, res) => {
  try {
    const threshold = parseFloat(req.query.threshold) || 0.5;
    const limit = parseInt(req.query.limit) || 50;

    // Validate parameters
    if (threshold < 0 || threshold > 1) {
      return res.status(400).json({ 
        error: "Threshold must be between 0 and 1" 
      });
    }

    // Get all artifacts
    const allArtifacts = await pipeline.searchArtifacts([{ name: "*" }], 0);
    
    const suspiciousArtifacts = [];

    // Analyze each artifact
    for (const metadata of allArtifacts.artifacts || []) {
      try {
        const artifact = await pipeline.getArtifact({ 
          type: metadata.type, 
          id: metadata.id 
        });
        
        if (!artifact) continue;

        const analysis = await analyzeArtifact(artifact);
        
        if (analysis.suspicion_score >= threshold) {
          suspiciousArtifacts.push({
            artifact_id: artifact.metadata.id,
            artifact_type: artifact.metadata.type,
            name: artifact.metadata.name,
            suspicion_score: analysis.suspicion_score,
            reasons: analysis.reasons
          });
        }

        // Stop if we've reached the limit
        if (suspiciousArtifacts.length >= limit) {
          break;
        }
      } catch (err) {
        console.error(`Error analyzing artifact ${metadata.id}:`, err);
        continue;
      }
    }

    // Sort by suspicion score (highest first)
    suspiciousArtifacts.sort((a, b) => b.suspicion_score - a.suspicion_score);

    return res.status(200).json({
      suspicious_artifacts: suspiciousArtifacts,
      count: suspiciousArtifacts.length,
      threshold,
      scanned: allArtifacts.artifacts?.length || 0
    });

  } catch (error) {
    console.error("Malicious detection error:", error);
    return res.status(500).json({ 
      error: "Failed to scan for malicious artifacts." 
    });
  }
});

/**
 * GET /artifact/:artifact_type/:id/malicious
 * Check if a specific artifact is suspected to be malicious
 */
router.get("/:artifact_type/:id", authenticateToken, async (req, res) => {
  try {
    const { artifact_type, id } = req.params;

    // Validate inputs
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

    // Analyze
    const analysis = await analyzeArtifact(artifact);

    return res.status(200).json({
      artifact_id: id,
      artifact_type,
      name: artifact.metadata?.name,
      is_suspicious: analysis.suspicion_score >= 0.5,
      suspicion_score: analysis.suspicion_score,
      reasons: analysis.reasons,
      details: analysis.details
    });

  } catch (error) {
    console.error("Malicious check error:", error);
    return res.status(500).json({ error: "Failed to check artifact." });
  }
});

/**
 * Analyze an artifact for suspicious characteristics
 */
async function analyzeArtifact(artifact) {
  const reasons = [];
  const details = {};
  let suspicionPoints = 0;
  let maxPoints = 0;

  // Check 1: Trust score (if available from rating)
  maxPoints += 3;
  const netScore = artifact.data?.net_score || artifact.metadata?.net_score;
  if (netScore !== undefined && netScore !== null) {
    details.net_score = netScore;
    if (netScore < 0.3) {
      suspicionPoints += 3;
      reasons.push("Very low trust score (< 0.3)");
    } else if (netScore < 0.5) {
      suspicionPoints += 2;
      reasons.push("Low trust score (< 0.5)");
    } else if (netScore < 0.7) {
      suspicionPoints += 1;
      reasons.push("Moderate trust score (< 0.7)");
    }
  }

  // Check 2: Suspicious URL domain
  maxPoints += 2;
  const url = artifact.data?.url || "";
  details.url = url;
  for (const domain of SUSPICIOUS_DOMAINS) {
    if (url.includes(domain)) {
      suspicionPoints += 2;
      reasons.push(`Suspicious URL domain: ${domain}`);
      break;
    }
  }

  // Check 3: Missing or suspicious license
  maxPoints += 2;
  const license = artifact.metadata?.license || artifact.data?.license;
  details.license = license || "none";
  if (!license) {
    suspicionPoints += 1;
    reasons.push("No license information");
  } else if (license.toLowerCase().includes("proprietary") || 
             license.toLowerCase().includes("custom")) {
    suspicionPoints += 1;
    reasons.push("Non-standard license");
  }

  // Check 4: Missing documentation
  maxPoints += 1;
  const hasReadme = artifact.data?.readme || artifact.metadata?.readme;
  const hasDescription = artifact.metadata?.description || artifact.data?.description;
  if (!hasReadme && !hasDescription) {
    suspicionPoints += 1;
    reasons.push("Missing documentation");
  }

  // Check 5: Suspicious patterns in metadata/description
  maxPoints += 2;
  const textToCheck = [
    artifact.metadata?.description || "",
    artifact.data?.description || "",
    artifact.data?.readme || ""
  ].join(" ");

  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.test(textToCheck)) {
      suspicionPoints += 2;
      reasons.push(`Suspicious code pattern detected: ${pattern.source}`);
      break;
    }
  }

  // Check 6: Recently created (less than 7 days old)
  maxPoints += 1;
  const createdAt = artifact.metadata?.created_at;
  if (createdAt) {
    const ageMs = Date.now() - new Date(createdAt).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    details.age_days = Math.floor(ageDays);
    
    if (ageDays < 1) {
      suspicionPoints += 1;
      reasons.push("Very recently created (< 1 day)");
    } else if (ageDays < 7) {
      suspicionPoints += 0.5;
      reasons.push("Recently created (< 7 days)");
    }
  }

  // Check 7: Unusual file patterns (if available)
  maxPoints += 1;
  const files = artifact.metadata?.files || [];
  if (Array.isArray(files)) {
    const hasExecutables = files.some(f => 
      f.endsWith(".exe") || f.endsWith(".sh") || f.endsWith(".bat")
    );
    if (hasExecutables) {
      suspicionPoints += 1;
      reasons.push("Contains executable files");
    }
  }

  // Calculate suspicion score (0-1)
  const suspicion_score = maxPoints > 0 ? suspicionPoints / maxPoints : 0;

  return {
    suspicion_score: Math.min(1, Math.max(0, suspicion_score)),
    reasons,
    details
  };
}

export default router;
