//app/src/server.js
import "dotenv/config";
import express from "express";


import healthRouter from "./routes/health.js";          // GET /health
import artifactRouter from "./routes/artifact.js";      // POST /artifact/:artifact_type
import artifactsRouter from "./routes/artifacts.js";    // GET  /artifacts/:artifact_type/:id
import rateRouter from "./routes/rate.js";
import tracksRouter from "./routes/tracks.js";          // GET /tracks
import resetRouter from "./routes/reset.js";            // DELETE /reset

const app = express();

app.use(express.json()); // parse JSON bodies


//OpenAPI routes
app.use("/health", healthRouter);
app.use("/artifact", artifactRouter);
app.use("/artifacts", artifactsRouter);
app.use("/tracks", tracksRouter);
app.use("/reset", resetRouter);
// Rate: GET /artifact/model/:id/rate
app.use("/artifact/model", rateRouter);

const port = process.env.PORT || 3100;
app.listen(port, () => {
  console.log(`listening on :${port}`);
});
