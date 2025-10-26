//app/src/pipelines/DataPipeline.js
import LocalAdapter from "../adapters/localAdapter.js";

const SELECTED_ADAPTER = "local";

let adapter;
switch (SELECTED_ADAPTER) {
  case "local":
    adapter = new LocalAdapter();
    break;
  // Future adapters like S3 can be added here
  default:
    adapter = new LocalAdapter();
    break;
}

class DataPipeline {
  async createArtifact(input) {
    return adapter.createArtifact(input);
  }
  async getArtifact(query) {
    return adapter.getArtifact(query);
  }
}

export default DataPipeline;
