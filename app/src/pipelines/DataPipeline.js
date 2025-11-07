//app/src/pipelines/DataPipeline.js
import LocalAdapter from "../adapters/localAdapter.js";
import S3Adapter from "../adapters/S3Adapter.js";

const SELECTED_ADAPTER = process.env.ADAPTER || "s3";

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
}

export default DataPipeline;
