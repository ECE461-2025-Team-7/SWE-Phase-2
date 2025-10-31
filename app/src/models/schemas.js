// app/src/models/schemas.js
// OpenAPI-aligned schemas + lightweight validators/builders for Phase 2 MVP.
// Use these from routers/pipelines to keep responses consistent.


export const ARTIFACT_TYPES = /** @type {ArtifactType[]} */ ([
  "model",
  "dataset",
  "code",
]);

export const ARTIFACT_TYPE_SET = new Set(ARTIFACT_TYPES);

// ---- Validators ------------------------------------------------------------

/** Validate ArtifactType string */
export function isValidArtifactType(type) {
  return typeof type === "string" && ARTIFACT_TYPE_SET.has(type);
}

/** Validate id against ^[A-Za-z0-9-]+$ (OpenAPI pattern) */
export function isValidArtifactId(id) {
  return typeof id === "string" && /^[A-Za-z0-9-]+$/.test(id) && id.length > 0;
}

/** Quick URL-ish check (we also try new URL() to normalize later) */
export function isLikelyUrl(v) {
  return typeof v === "string" && v.length > 0;
}

// ---- Normalization helpers -------------------------------------------------

/** Normalize URLs consistently (strip hash, auth, trailing slash) */
export function normalizeUrl(u) {
  try {
    const url = new URL(u);
    url.hash = "";
    url.username = "";
    url.password = "";
    url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString();
  } catch {
    return String(u).trim();
  }
}

/** Derive a display name from a URL path (HF/GitHub friendly) */
export function deriveNameFromUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    const parts = u.pathname.split("/").filter(Boolean);
    const treeIdx = parts.findIndex((p) => p === "tree" || p === "blob");
    if (treeIdx > -1) return parts[Math.max(0, treeIdx - 1)] || u.hostname.replace(/\./g, "-");
    return parts[parts.length - 1] || u.hostname.replace(/\./g, "-");
  } catch {
    return String(urlStr).trim().replace(/[^A-Za-z0-9-_]/g, "-").slice(0, 128) || "artifact";
  }
}

// ---- Builders (ensure we always emit OpenAPI-shaped objects) ---------------

export function buildMetadata(name, id, type) {
  if (typeof name !== "string" || name.length === 0) {
    throw new Error("Invalid metadata.name");
  }
  if (!isValidArtifactId(id)) {
    throw new Error("Invalid metadata.id");
  }
  if (!isValidArtifactType(type)) {
    throw new Error("Invalid metadata.type");
  }
  return { name, id, type };
}

export function buildData(url) {
  if (!isLikelyUrl(url)) {
    throw new Error("Invalid data.url");
  }
  return { url: normalizeUrl(url) };
}


export function buildArtifact(metadata, data) {
  // minimal runtime guard
  if (!metadata || !data) throw new Error("Artifact requires metadata and data");
  return { metadata, data };
}

// ---- Request parsers for routers ------------------------------------------

export function parseArtifactDataBody(body) {
  if (!body || typeof body !== "object") {
    throw new Error("Body must be a JSON object");
  }
  const { url } = body;
  if (!isLikelyUrl(url)) {
    throw new Error("Body must include string property 'url'");
  }
  return buildData(url);
}

export function parseArtifactQueryArray(body) {
  if (!Array.isArray(body)) throw new Error("Request body must be an array");
  return body.map((q, i) => {
    if (!q || typeof q !== "object") throw new Error(`Query[${i}] must be an object`);
    const out = {};
    if (q.name !== undefined) {
      if (typeof q.name !== "string") throw new Error(`Query[${i}].name must be a string`);
      out.name = q.name;
    }
    if (q.types !== undefined) {
      if (!Array.isArray(q.types) || q.types.some((t) => !isValidArtifactType(t))) {
        throw new Error(`Query[${i}].types must be an array of valid artifact types`);
      }
      out.types = /** @type {ArtifactType[]} */ (q.types);
    }
    return /** @type {ArtifactQuery} */ (out);
  });
}
