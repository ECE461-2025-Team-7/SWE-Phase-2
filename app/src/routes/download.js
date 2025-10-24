//app/src/routes/download.js
//deals with the download route
import express from "express";
import DataPipeline from "../pipelines/DataPipeline.js";

const router = express.Router();
const pipeline = new DataPipeline();

// GET /download?name=foo
router.get("/", async (req, res) => {
  const { name } = req.query || {};
  if (!name) {
    return res.status(400).json({ error: "name is required" });
  }

  const query = { name };
  await pipeline.getData(query); // your current impl just logs

  return res.json({ ok: true, data: query });
});

export default router;