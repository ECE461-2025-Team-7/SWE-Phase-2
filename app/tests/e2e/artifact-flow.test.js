import { test } from "node:test";
import assert from "node:assert/strict";

process.env.ADAPTER = "local";

const { requireAuth, validateArtifactType, validateArtifactBody, validateIdParam } = await import(
  "../../src/utils/http-helpers.js"
);
const { default: DataPipeline } = await import("../../src/pipelines/DataPipeline.js");
const { createArtifactHandler } = await import("../../src/routes/artifact.js");
const { getArtifactHandler } = await import("../../src/routes/artifacts.js");

const pipeline = new DataPipeline();

function createReq({ params = {}, body = {}, headers = {}, method = "POST" } = {}) {
  return {
    params,
    body,
    method,
    header(name) {
      const key = Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase());
      return key ? headers[key] : undefined;
    },
    get(name) {
      return this.header(name);
    },
    is(type) {
      const contentType = this.header("Content-Type");
      if (!contentType) return false;
      return contentType.toLowerCase() === type.toLowerCase();
    },
  };
}

function createRes() {
  return {
    statusCode: 200,
    payload: null,
    finished: false,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.payload = body;
      this.finished = true;
      return this;
    },
  };
}

async function runHandlers(handlers, req, res) {
  for (const handler of handlers) {
    let nextCalled = false;
    const maybePromise = handler(req, res, (err) => {
      nextCalled = true;
      if (err) throw err;
    });
    if (maybePromise && typeof maybePromise.then === "function") {
      await maybePromise;
    }
    if (res.finished && !nextCalled) {
      return;
    }
  }
}

test("artifact lifecycle: upload then retrieve", async () => {
  await pipeline.reset();

  const createReqObj = createReq({
    params: { artifact_type: "model" },
    body: { url: "https://huggingface.co/openai/whisper/tree/main" },
    headers: { "X-Authorization": "token", "Content-Type": "application/json" },
  });
  const createResObj = createRes();

  await runHandlers(
    [requireAuth, validateArtifactType, validateArtifactBody, createArtifactHandler],
    createReqObj,
    createResObj
  );

  const { metadata, data } = createResObj.payload;
  assert.equal(createResObj.statusCode, 201);
  assert.equal(metadata.type, "model");
  assert.equal(metadata.name, "whisper");
  assert.ok(metadata.id);
  assert.equal(data.url, "https://huggingface.co/openai/whisper/tree/main");

  const getReqObj = createReq({
    method: "GET",
    params: { artifact_type: metadata.type, id: metadata.id },
    headers: { "X-Authorization": "token" },
  });
  const getResObj = createRes();

  await runHandlers(
    [requireAuth, validateArtifactType, validateIdParam, getArtifactHandler],
    getReqObj,
    getResObj
  );

  assert.equal(getResObj.statusCode, 200);
  assert.deepEqual(getResObj.payload.metadata, metadata);
  assert.deepEqual(getResObj.payload.data, data);
});

test("uploading the same URL twice is rejected", async () => {
  await pipeline.reset();
  const url = "https://github.com/example/repo";

  const firstReq = createReq({
    params: { artifact_type: "model" },
    body: { url },
    headers: { "X-Authorization": "token", "Content-Type": "application/json" },
  });
  const firstRes = createRes();
  await runHandlers([requireAuth, validateArtifactType, validateArtifactBody, createArtifactHandler], firstReq, firstRes);
  assert.equal(firstRes.statusCode, 201);

  const duplicateReq = createReq({
    params: { artifact_type: "model" },
    body: { url },
    headers: { "X-Authorization": "token", "Content-Type": "application/json" },
  });
  const duplicateRes = createRes();
  await runHandlers(
    [requireAuth, validateArtifactType, validateArtifactBody, createArtifactHandler],
    duplicateReq,
    duplicateRes
  );
  assert.equal(duplicateRes.statusCode, 409);
  assert.deepEqual(duplicateRes.payload, { error: "Artifact exists already." });
});
