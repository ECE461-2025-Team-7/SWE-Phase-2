import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateArtifactBody,
  validateArtifactShape,
  parseNameFromUrl,
} from "../../src/utils/http-helpers.js";

function createMockRes() {
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

test("parseNameFromUrl extracts model name before tree/blob segments", () => {
  const name = parseNameFromUrl("https://huggingface.co/openai/whisper/tree/main");
  assert.equal(name, "whisper");
});

test("parseNameFromUrl sanitizes malformed strings", () => {
  const name = parseNameFromUrl(" not a url ");
  assert.equal(name, "not-a-url");
});

test("validateArtifactBody allows proper JSON payloads", () => {
  const req = {
    is: (type) => type === "application/json",
    body: { url: "https://example.com/model" },
  };
  const res = createMockRes();
  let nextCalled = false;

  validateArtifactBody(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.payload, null);
});

test("validateArtifactBody rejects non-JSON payloads", () => {
  const req = {
    is: () => false,
    body: { url: "https://example.com" },
  };
  const res = createMockRes();

  validateArtifactBody(req, res, () => {});

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.payload, { error: "Content-Type must be application/json" });
});

test("validateArtifactBody rejects invalid URLs", () => {
  const req = {
    is: (type) => type === "application/json",
    body: { url: "ht!tp://bad" },
  };
  const res = createMockRes();

  validateArtifactBody(req, res, () => {});

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.payload, { error: "url must be a valid URI" });
});

test("validateArtifactShape only accepts well-formed artifacts", () => {
  const goodArtifact = {
    metadata: { name: "demo", id: "abc123", type: "model" },
    data: { url: "https://example.com/ok" },
  };
  const badArtifact = {
    metadata: { name: "", id: "abc123", type: "model" },
    data: { url: "notaurl" },
  };

  assert.equal(validateArtifactShape(goodArtifact), true);
  assert.equal(validateArtifactShape(badArtifact), false);
});
