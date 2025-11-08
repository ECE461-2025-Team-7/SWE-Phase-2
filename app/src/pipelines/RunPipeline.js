// app/src/pipelines/RunPipeline.js
// Bridge between the web API and the Python core via src/web_utils.py
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import DataPipeline from "./DataPipeline.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// repoRoot = <repo>/ (we are in <repo>/app/src/pipelines)
const repoRoot = path.resolve(__dirname, "../../../");

class RunPipeline {
  async executeRun(params = {}) {
    const { id, authToken } = params || {};
    if (!id) {
      const err = new Error("model id is required");
      err.code = "VALIDATION_ERROR";
      throw err;
    }

    // Look up the artifact (uploaded earlier) to get its URL
    const dataPipeline = new DataPipeline();
    const artifact = await dataPipeline.getArtifact({ type: "model", id });
    if (!artifact || !artifact?.data?.url) {
      const err = new Error("model not found");
      err.code = "NOT_FOUND";
      throw err;
    }

    const url = String(artifact.data.url).trim();

    // Prepare child process env and working directory
    const env = { ...process.env, PYTHONPATH: repoRoot };
    if (authToken) env.GITHUB_TOKEN = String(authToken);

    const pyArgs = [
      "-c",
      // Print a single JSON object to stdout using src/web_utils.rate_url
      "import json, sys; from src.web_utils import rate_url; print(json.dumps(rate_url(sys.argv[1])))",
      url,
    ];

    const stdout = await new Promise((resolve, reject) => {
      const child = spawn("python3", pyArgs, { cwd: repoRoot, env });

      let out = "";
      let err = "";
      const timer = setTimeout(() => {
        try { child.kill("SIGKILL"); } catch {}
      }, 60_000); // safety timeout: 60s

      child.stdout.on("data", (buf) => { out += String(buf); });
      child.stderr.on("data", (buf) => { err += String(buf); });
      child.on("error", (e) => {
        clearTimeout(timer);
        const ex = new Error(`python spawn failed: ${e.message}`);
        ex.code = "PIPELINE_ERROR";
        ex.details = err;
        reject(ex);
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        if (code !== 0) {
          const ex = new Error(`python exited with code ${code}`);
          ex.code = "PIPELINE_ERROR";
          ex.details = err || out;
          return reject(ex);
        }
        resolve(out);
      });
    });

    // The Python snippet prints exactly one JSON object
    const text = String(stdout).trim();
    const line = text.split(/\r?\n/).find((l) => l.trim().startsWith("{")) || text;
    try {
      return JSON.parse(line);
    } catch (e) {
      const err = new Error("failed to parse rating JSON");
      err.code = "PIPELINE_ERROR";
      err.details = { stdout: text.slice(0, 2048) };
      throw err;
    }
  }
}

export default RunPipeline;