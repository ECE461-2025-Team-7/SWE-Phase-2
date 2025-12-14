//app/src/pipelines/DataPipeline.js
import LocalAdapter from "../adapters/localAdapter.js";
import S3Adapter from "../adapters/S3Adapter.js";

const SELECTED_ADAPTER = process.env.ADAPTER_TYPE || process.env.ADAPTER || "s3";

let adapter;
switch (SELECTED_ADAPTER) {
  case "local":
    adapter = new LocalAdapter();
    break;
  case "s3":
    adapter = new S3Adapter();
    break;
  default:
    adapter = new S3Adapter();
    break;
}

class DataPipeline {
  async createArtifact(input) {
    return adapter.createArtifact(input);
  }
  async getArtifact(query) {
    return adapter.getArtifact(query);
  }
  async updateArtifact(input) {
    return adapter.updateArtifact(input);
  }
  async deleteArtifact(query) {
    return adapter.deleteArtifact(query);
  }
  async searchArtifacts(queries, offset = 0) {
    return adapter.searchArtifacts(queries, offset);
  }
  async searchArtifactsByRegex(regex, offset = 0) {
    return adapter.searchArtifactsByRegex(regex, offset);
  }
  async reset() {
    return adapter.reset();
  }
  //download stuff
  async getBundleStream(type, id) {
    if (typeof adapter.getBundleStream === "function") {
      return adapter.getBundleStream(type, id);
    }
    return null;
  }
  // Security Track: Debloat program management
  async storeDebloatProgram(type, id, program, username) {
    return adapter.storeDebloatProgram?.(type, id, program, username) || 
      Promise.resolve({ success: true });
  }

  async getDebloatProgram(type, id) {
    return adapter.getDebloatProgram?.(type, id) || Promise.resolve(null);
  }

  async deleteDebloatProgram(type, id) {
    return adapter.deleteDebloatProgram?.(type, id) || Promise.resolve(true);
  }

  // Security Track: Historical tracking
  async recordHistory(type, id, username, action, changes) {
    return adapter.recordHistory?.(type, id, username, action, changes) || 
      Promise.resolve({ success: true });
  }

  async getArtifactHistory(type, id, limit = 100) {
    return adapter.getArtifactHistory?.(type, id, limit) || Promise.resolve([]);
  }
}

export default DataPipeline;
