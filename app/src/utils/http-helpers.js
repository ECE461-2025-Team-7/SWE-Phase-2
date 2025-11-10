//app/src/utils/http-helpers.js
// Utility middleware and helpers for HTTP routes
import { authenticateToken, requireAdmin } from "../middleware/authMiddleware.js";

const ARTIFACT_TYPES = new Set(["model", "dataset", "code"]);

// Functions for both upload and download routes-------------------------------------------------------

// Middleware to require authentication via X-Authorization header
// Now uses proper JWT validation from authMiddleware
export const requireAuth = authenticateToken;

// Middleware to validate reset permission - requires admin privileges
// According to OpenAPI spec: 401 if not authorized, 403 if invalid token
export const validateResetToken = requireAdmin;

// Validate the artifact type
export function validateArtifactType(req, res, next) {
  const { artifact_type } = req.params || {};
  if (!artifact_type || !ARTIFACT_TYPES.has(artifact_type)) {
    return res.status(400).json({ error: "artifact_type must be one of: model, dataset, code" });
  }
  return next();
}


// Functions for upload route-------------------------------------------------------

//  Validate the request body for upload
export function validateArtifactBody(req, res, next) {
  // Content-Type must be JSON per spec for create
  if (!req.is("application/json")) {
    return res.status(400).json({ error: "Content-Type must be application/json" });
  }
  const { url } = req.body || {};
  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "artifact_data must include a string 'url'" });
  }
  try {
    new URL(url);
  } catch {
    return res.status(400).json({ error: "url must be a valid URI" });
  }
  return next();
}

// Name extraction from URL
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

//For download route-------------------------------------------------------

// Validate artifact object shape for download
export function validateArtifactShape(artifact) {
  if (!artifact || typeof artifact !== "object") return false;
  const { metadata, data } = artifact;
  if (!metadata || typeof metadata !== "object") return false;
  const { name, id, type } = metadata;
  if (!name || typeof name !== "string") return false;
  if (!id || typeof id !== "string" || !/^[A-Za-z0-9-]+$/.test(id)) return false;
  if (!type || typeof type !== "string" || !ARTIFACT_TYPES.has(type)) return false;
  if (!data || typeof data !== "object") return false;
  if (!data.url || typeof data.url !== "string") return false;
  try {
    new URL(data.url);
  } catch {
    return false;
  }
  return true;
}

// Validate the id based on the spec
export function validateIdParam(req, res, next) {
  const { id } = req.params || {};
  if (!id || typeof id !== "string" || !/^[A-Za-z0-9-]+$/.test(id)) {
    return res.status(400).json({ error: "Invalid artifact id." });
  }
  return next();
}