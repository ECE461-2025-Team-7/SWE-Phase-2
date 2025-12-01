// app/src/routes/artifact.js
// This is basically the upload route
import express from "express";
import DataPipeline from "../pipelines/DataPipeline.js";
import { requireAuth, validateArtifactType, validateArtifactBody, parseNameFromUrl, validateArtifactRegexBody, parseOffset } from "../utils/http-helpers.js";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const router = express.Router();
const pipeline = new DataPipeline();

// Resolve repository root for PYTHONPATH when spawning Python helpers
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// repoRoot = <repo>/ (we are in <repo>/app/backend/src/routes)
const repoRoot = path.resolve(__dirname, "../../../../");

// Compute threshold from env with sensible defaults
function getRatingThreshold() {
  // Prefer MIN_NET_SCORE, fallback to RATING_THRESHOLD, default 0.5
  const raw = process.env.MIN_NET_SCORE ?? process.env.RATING_THRESHOLD ?? "0.5";
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0.5;
  // Clamp between 0 and 1 for safety
  return Math.max(0, Math.min(1, n));
}

// Rate the URL via Python (src/web_utils.rate_url) and compare to threshold
async function score_validate(url, authToken) {
  console.log("[DEBUG] score_validate called for URL:", url);
  
  if (!url || typeof url !== "string") {
    console.log("[DEBUG] URL validation failed - invalid or missing URL");
    return false;
  }
  
  const env = { ...process.env, PYTHONPATH: repoRoot };
  if (authToken) env.GITHUB_TOKEN = String(authToken);

  const pyArgs = [
    "-c",
    "import json, sys; from src.web_utils import rate_url; print(json.dumps(rate_url(sys.argv[1])))",
    String(url).trim(),
  ];

  try {
    const stdout = await new Promise((resolve, reject) => {
      const child = spawn("python3", pyArgs, { cwd: repoRoot, env });
      let out = "";
      let err = "";
      const timer = setTimeout(() => {
        try { child.kill("SIGKILL"); } catch {}
      }, 60_000);
      child.stdout.on("data", (buf) => { out += String(buf); });
      child.stderr.on("data", (buf) => { 
        const errText = String(buf);
        console.log("[DEBUG] Python stderr:", errText);
        err += errText; 
      });
      child.on("error", (e) => {
        clearTimeout(timer);
        const ex = new Error(`python spawn failed: ${e.message}`);
        ex.details = err;
        reject(ex);
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        if (code !== 0) {
          const ex = new Error(`python exited with code ${code}`);
          ex.details = err || out;
          return reject(ex);
        }
        resolve(out);
      });
    });

    const text = String(stdout).trim();
    console.log("[DEBUG] Python stdout (raw):", text.substring(0, 500));
    
    const line = text.split(/\r?\n/).find((l) => l.trim().startsWith("{")) || text;
    let obj;
    try {
      obj = JSON.parse(line);
      console.log("[DEBUG] Parsed JSON successfully. Keys:", Object.keys(obj));
    } catch (parseErr) {
      console.error("[DEBUG] JSON parse failed:", parseErr.message);
      console.error("[DEBUG] Attempted to parse:", line.substring(0, 200));
      return false;
    }
    
    const threshold = getRatingThreshold();
    const rawScore = Number(obj?.net_score);
    const score = Number.isFinite(rawScore) ? rawScore : 0;
    
    console.log("[DEBUG] Scoring details:");
    console.log("  - Threshold:", threshold);
    console.log("  - Raw net_score from Python:", obj?.net_score);
    console.log("  - Parsed score:", score);
    console.log("  - Score >= Threshold:", score >= threshold);
    console.log("  - Pass validation:", score >= threshold);
    
    return score >= threshold;
  } catch (e) {
    // Conservative: on failure to rate, do not accept
    console.error("[DEBUG] score_validate failed with exception:", e);
    console.error("[DEBUG] Error details:", e.details || e.message);
    return false;
  }
}

/*
  POST /artifact/byRegEx (BASELINE: search by regex)
  Body: { regex: "<pattern>" }
  Optional query param: offset (string integer) for pagination.
  Returns array of ArtifactMetadata whose names match the regex.
*/
router.post("/byRegEx", requireAuth, validateArtifactRegexBody, parseOffset, async (req, res) => {
  try {
    const { regex } = req.body || {};
    const offset = req.offset ?? 0;
    const { artifacts, nextOffset } = await pipeline.searchArtifactsByRegex(regex, offset);
    if (!artifacts || artifacts.length === 0) {
      return res.status(404).json({ error: "No artifacts found." });
    }
    if (nextOffset !== null && nextOffset !== undefined) {
      res.set("offset", String(nextOffset));
    }
    return res.status(200).json(artifacts);
  } catch (err) {
    console.error("ArtifactRegEx error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/* 
  POST /artifact/:artifact_type   (BASELINE: create/upload)
  This route allows authenticated users to upload a new artifact of the specified type.
  
  The functions used as middleware before the handler are
  - requireAuth: Ensures the request includes a valid authentication token.
  - validateArtifactType: Validates that the artifact_type parameter is one of the allowed types (model, dataset, code).
  - validateArtifactBody: Validates the request body to ensure it contains a valid URL for the artifact.
  
  Then the handler extracts the artifact_type, url, and name, and uses the 
  pipeline to upload the artifact.
*/
router.post("/:artifact_type", requireAuth, validateArtifactType, validateArtifactBody, async (req, res) => {
  try {
    //Getting the parameters
    const artifact_type = req.params.artifact_type;
    const { url } = req.body || {};
    const name = parseNameFromUrl(url);

    // pass auth to Python for any authenticated upstream API calls
    const authToken = req.header("X-Authorization");
    // Gate registration on rating threshold
    if (!(await score_validate(url, authToken))) {
      const e = new Error("Artifact not registered due to disqualified rating.");
      e.code = "ARTIFACT_DISQUALIFIED";
      throw e;
    }
    //Upload via pipeline
    const artifact = await pipeline.createArtifact({ type: artifact_type, name, url });
    return res.status(201).json(artifact);
  } 
  catch (err) {     //Catch errors from the pipeline
    if (err?.code === "FORBIDDEN") {
      return res.status(403).json({ error: "Forbidden." });
    }
    if (err?.code === "VALIDATION_ERROR") {
      return res.status(400).json({ error: err.message || "Invalid request." });
    }
    if (err?.code === "ARTIFACT_EXISTS") {
      return res.status(409).json({ error: "Artifact exists already." });
    }
    if (err?.code === "ARTIFACT_DISQUALIFIED") {
      return res.status(424).json({ error: "Artifact not registered due to disqualified rating." });
    }
    console.error("ArtifactCreate error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
