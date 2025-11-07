//app/src/server.js
import "dotenv/config";
import express from "express";

import rateRouter from "./routes/rate.js";
import artifactRouter from "./routes/artifact.js";     // POST /artifact/:artifact_type
import artifactsRouter from "./routes/artifacts.js";   // GET  /artifacts/:artifact_type/:id

const app = express();

app.use(express.json()); // parse JSON bodies



app.get("/health", (_req, res) => res.json({ ok: true }));
//OpenAPI routes for upload and download
app.use("/artifact", artifactRouter);
app.use("/artifacts", artifactsRouter);
// Rate: GET /artifact/model/:id/rate
app.use("/artifact/model", rateRouter);

const port = process.env.PORT || 3100;
app.listen(port, () => {
  console.log(`listening on :${port}`);
});
