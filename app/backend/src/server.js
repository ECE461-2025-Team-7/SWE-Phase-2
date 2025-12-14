//app/src/server.js
import "dotenv/config";
import express from "express";


import healthRouter from "./routes/health.js";          // GET /health
import artifactRouter from "./routes/artifact.js";      // POST /artifact/:artifact_type
import artifactsRouter from "./routes/artifacts.js";    // GET  /artifacts/:artifact_type/:id
import rateRouter from "./routes/rate.js";
import authenticateRouter from "./routes/authenticate.js"; // PUT /authenticate
import usersRouter from "./routes/users.js";            // User management routes
import tracksRouter from "./routes/tracks.js";          // GET /tracks
import resetRouter from "./routes/reset.js";            // DELETE /reset
import costRouter from "./routes/cost.js";              // GET /artifact/:type/:id/cost
import lineageRouter from "./routes/lineage.js";        // GET /artifact/model/:id/lineage
import licenseCheckRouter from "./routes/license-check.js"; // POST /artifact/model/:id/license-check
import debloatRouter from "./routes/debloat.js";        // Security Track: Debloat programs
import historyRouter from "./routes/history.js";        // Security Track: Historical tracking
import maliciousRouter from "./routes/malicious.js";    // Security Track: Malicious detection
import downloadRouter from "./routes/download.js";    // GET /download/:artifact_type/:id

const app = express();

app.use(express.json()); // parse JSON bodies

// Enable CORS for frontend development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, X-Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

// Log all requests
app.use((req, _res, next) => {
  console.log(`[req] ${req.method} ${req.url}`);
  next();
});

// Authentication: PUT /authenticate
app.use("/authenticate", authenticateRouter);

// User management (admin only)
app.use("/users", usersRouter);

//OpenAPI routes
app.use("/health", healthRouter)
app.use("/artifact", artifactRouter);
app.use("/artifacts", artifactsRouter);
app.use("/tracks", tracksRouter);
app.use("/reset", resetRouter);

// Model-specific routes
app.use("/artifact/model", rateRouter);          // GET /artifact/model/:id/rate
app.use("/artifact/model", lineageRouter);       // GET /artifact/model/:id/lineage
app.use("/artifact/model", licenseCheckRouter);  // POST /artifact/model/:id/license-check

// Cost route (works for all artifact types)
app.use("/artifact", costRouter);                // GET /artifact/:type/:id/cost

// Security Track routes
app.use("/artifact", debloatRouter);             // POST/GET/DELETE /artifact/:type/:id/debloat
app.use("/artifact", historyRouter);             // GET/POST /artifact/:type/:id/history  
app.use("/artifact/malicious", maliciousRouter); // GET /artifact/malicious
app.use("/download", downloadRouter);           // GET /download/:artifact_type/:id


const port = process.env.PORT || 3100;
app.listen(port, () => {
  console.log(`listening on :${port}`);
});
