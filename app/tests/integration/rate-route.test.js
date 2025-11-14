import { test } from "node:test";
import assert from "node:assert/strict";

process.env.ADAPTER = "local";

const { default: RunPipeline } = await import("../../src/pipelines/RunPipeline.js");
const { handleRateRequest } = await import("../../src/routes/rate.js");

const ORIGINAL_EXECUTE_RUN = RunPipeline.prototype.executeRun;

function createReq({ id = "demo", headers = {} } = {}) {
  return {
    params: { id },
    header(name) {
      const key = Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase());
      return key ? headers[key] : undefined;
    },
  };
}

function createRes() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.payload = body;
      return this;
    },
  };
}

function restorePipeline() {
  RunPipeline.prototype.executeRun = ORIGINAL_EXECUTE_RUN;
}

test("rate handler enforces X-Authorization header", async () => {
  const req = createReq({ headers: {} });
  const res = createRes();
  await handleRateRequest(req, res);
  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.payload, { error: "missing authentication token" });
});

test("rate handler passes id + token to pipeline", async () => {
  const seen = [];
  RunPipeline.prototype.executeRun = async (args) => {
    seen.push(args);
    return { overall: 0.77 };
  };

  const req = createReq({
    headers: { "X-Authorization": "abc123" },
  });
  const res = createRes();

  try {
    await handleRateRequest(req, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.payload, { overall: 0.77 });
    assert.deepEqual(seen, [{ id: "demo", authToken: "abc123" }]);
  } finally {
    restorePipeline();
  }
});

test("rate handler returns 500 when pipeline fails", async () => {
  RunPipeline.prototype.executeRun = async () => {
    throw new Error("boom");
  };

  const req = createReq({
    headers: { "X-Authorization": "abc123" },
  });
  const res = createRes();

  try {
    await handleRateRequest(req, res);
    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.payload, { error: "failed to retrieve rating" });
  } finally {
    restorePipeline();
  }
});
