//app/src/utils/http-helpers.js
// Utility middleware and helpers for HTTP routes

// Header is required by spec; token format is flexible. We only require presence for MVP.
export function requireAuth(req, res, next) {
  const token = req.header("X-Authorization");
  if (!token) return res.status(403).json({ error: "Missing X-Authorization header." });
  // You can later validate JWT or session here.
  return next();
}

const ARTIFACT_TYPES = new Set(["model", "dataset", "code"]);

export function validateArtifactType(req, res, next) {
  const { artifact_type } = req.params || {};
  if (!artifact_type || !ARTIFACT_TYPES.has(artifact_type)) {
    return res.status(400).json({ error: "artifact_type must be one of: model, dataset, code" });
  }
  return next();
}

// Per spec: ArtifactID pattern ^[a-zA-Z0-9\-]+$ (we use that when generating; at read time, validate len/pattern)
export function validateIdParam(req, res, next) {
  const { id } = req.params || {};
  if (!id || typeof id !== "string" || !/^[A-Za-z0-9-]+$/.test(id)) {
    return res.status(400).json({ error: "Invalid artifact id." });
  }
  return next();
}

// Best-effort name extraction (HuggingFace/GitHub/HTTP URLs)
export function parseNameFromUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    // Remove trailing slash, split, drop empty parts
    const parts = u.pathname.split("/").filter(Boolean);

    // Handle common /tree/<rev>/… or /blob/<rev>/… cases: pick the "repo/model" leaf name
    const treeIdx = parts.findIndex((p) => p === "tree" || p === "blob");
    if (treeIdx > -1 && parts.length > treeIdx + 1) {
      // name is the segment before /tree or /blob if repo/model sits just before it
      // e.g. /openai/whisper/tree/main  -> "whisper"
      return parts[Math.max(0, treeIdx - 1)];
    }

    // Otherwise: take the last path segment
    return parts[parts.length - 1] || u.hostname.replace(/\./g, "-");
  } catch {
    // Fallback: sanitize input string
    return String(urlStr).trim().replace(/[^A-Za-z0-9-_]/g, "-").slice(0, 128) || "artifact";
  }
}