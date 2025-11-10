//app/src/adapters/localAdapter.js
import { randomUUID } from "crypto";

class LocalAdapter {
  store = new Map();

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

  async reset() {
    // Clear in-memory store
    this.store.clear();
  }
}

export default LocalAdapter;