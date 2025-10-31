//app/src/adapters/localAdapter.js
import { randomUUID } from "crypto";

class LocalAdapter {
  store = new Map();

  async createArtifact(input) {
    const id = randomUUID();
    const artifact = {
      metadata: { name: input.name, id, type: input.type },
      data: { url: String(input.url) },
    };
    this.store.set(`${input.type}:${id}`, artifact);
    return artifact;
  }

  async getArtifact(query) {
    return this.store.get(`${query.type}:${query.id}`) || null;
    }
}

export default LocalAdapter;
