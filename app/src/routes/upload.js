//app/src/routes/upload.js
//deals with the upload route
import express from "express";
import DataPipeline from "../pipelines/DataPipeline.js";

const router = express.Router();
const pipeline = new DataPipeline();

// POST /upload
// body: { name: string, url: string }
router.post("/", async (req, res) => {
  const { name, url } = req.body || {};
  if (!name || !url) {
    return res.status(400).json({ error: "name and url are required" });
  }

  const data = { name, url };
  await pipeline.postData(data); // your current impl just logs

  return res.status(201).json({ ok: true, data });
});

export default router;