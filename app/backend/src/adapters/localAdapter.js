//app/src/adapters/localAdapter.js
import { randomUUID } from "crypto";

class LocalAdapter {
  store = new Map();
  pageSize = 100;

  async createArtifact(input) {
    // Normalize URL for comparison/storage
    const rawUrl = String(input.url);
    let normalizedUrl = rawUrl;
    try {
      normalizedUrl = new URL(rawUrl).href;
    } catch {
      // leave as-is; higher layers should validate URLs
      normalizedUrl = rawUrl;
    }

    // Check for existing artifact with same URL (across all types)
    for (const [key, art] of this.store.entries()) {
      const storedUrl = art?.data?.url;
      if (!storedUrl) continue;
      // only attempt to parse; if parsing fails, skip this entry
      let storedNormalized;
      try {
        storedNormalized = new URL(String(storedUrl)).href;
      } catch {
        continue;
      }
      if (storedNormalized === normalizedUrl) {
        const err = new Error("Artifact exists already.");
        err.code = "ARTIFACT_EXISTS";
        throw err;
      }
    }

    const id = randomUUID();
    const artifact = {
      metadata: { name: input.name, id, type: input.type },
      data: { url: normalizedUrl },
    };
    this.store.set(`${input.type}:${id}`, artifact);
    return artifact;
  }

  async getArtifact(query) {
    return this.store.get(`${query.type}:${query.id}`) || null;
  }

  async deleteArtifact({ type, id }) {
    const key = `${type}:${id}`;
    if (!this.store.has(key)) {
      return false; // Artifact not found
    }
    this.store.delete(key);
    return true; // Successfully deleted
  }

  async updateArtifact({ type, id, url }) {
    const key = `${type}:${id}`;
    const current = this.store.get(key);
    if (!current) return null;

    const rawUrl = String(url);
    let normalizedUrl = rawUrl;
    try {
      normalizedUrl = new URL(rawUrl).href;
    } catch {
      normalizedUrl = rawUrl;
    }

    const existing = current?.data?.url;
    let existingNormalized = existing;
    try {
      existingNormalized = new URL(String(existing)).href;
    } catch {
      // keep as-is
    }

    // No change
    if (existingNormalized === normalizedUrl) {
      return current;
    }

    const updated = {
      ...current,
      data: { ...current.data, url: normalizedUrl },
    };
    this.store.set(key, updated);
    return updated;
  }

  async reset() {
    // Clear in-memory store
    this.store.clear();
  }

  // Enumerate artifacts matching queries (POST /artifacts)
  async searchArtifacts(queries, offset = 0) {
    const limit = this.pageSize;
    const seen = new Set();
    const results = [];

    const hasWildcard = queries.some((q) => q.name === "*");
    const wildcardTypes = new Set();
    for (const q of queries) {
      if (q.name === "*" && Array.isArray(q.types)) {
        for (const t of q.types) wildcardTypes.add(t);
      }
    }

    // Helper to check if artifact matches provided queries
    const matchesQuery = (artifact) => {
      const { name, type, id } = artifact.metadata || {};
      if (!name || !type || !id) return false;

      if (hasWildcard) {
        if (wildcardTypes.size === 0) return true;
        return wildcardTypes.has(type);
      }

      for (const q of queries) {
        if (q.name !== name) continue;
        if (q.types && q.types.length > 0 && !q.types.includes(type)) continue;
        return true;
      }
      return false;
    };

    // Iterate in insertion order
    let skipped = 0;
    for (const [_key, artifact] of this.store.entries()) {
      if (!matchesQuery(artifact)) continue;
      const meta = artifact.metadata;
      const dedupKey = `${meta.type}:${meta.id}`;
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);

      if (skipped < offset) {
        skipped += 1;
        continue;
      }

      if (results.length < limit) {
        results.push({ ...meta });
      } else {
        break;
      }
    }

    const nextOffset = results.length === limit ? offset + results.length : null;
    return { artifacts: results, nextOffset };
  }

  // Enumerate artifacts matching a regex against name (POST /artifact/byRegEx)
  async searchArtifactsByRegex(regex, offset = 0) {
    const limit = this.pageSize;
    const re = new RegExp(regex);
    const results = [];

    let skipped = 0;
    for (const [_key, artifact] of this.store.entries()) {
      const meta = artifact.metadata;
      if (!meta?.name || !re.test(meta.name)) continue;

      if (skipped < offset) {
        skipped += 1;
        continue;
      }
      if (results.length < limit) {
        results.push({ ...meta });
      } else {
        break;
      }
    }

    const nextOffset = results.length === limit ? offset + results.length : null;
    return { artifacts: results, nextOffset };
  }
}

export default LocalAdapter;
