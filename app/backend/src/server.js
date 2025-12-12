//app/src/server.js
import "dotenv/config";
import express from "express";
import { createLogger } from "./utils/logger.js";

const logger = createLogger("Server");


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

// Log all requests with structured logging
app.use((req, res, next) => {
  const start = Date.now();
  
  // Log request
  logger.info("Incoming request", {
    method: req.method,
    path: req.path,
    query: Object.keys(req.query).length > 0 ? req.query : undefined,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  
  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info("Request completed", {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`
    });
  });
  
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


const port = process.env.PORT || 3100;
app.listen(port, () => {
  const adapterType = process.env.ADAPTER_TYPE || process.env.ADAPTER || 's3';
  logger.info("Server started", {
    port,
    env: process.env.NODE_ENV || 'development',
    adapter: adapterType,
    logLevel: process.env.LOG_LEVEL || 'INFO',
    s3Bucket: process.env.S3_BUCKET,
    s3Prefix: process.env.S3_PREFIX || '',
    authBucket: process.env.S3_AUTH_BUCKET || process.env.S3_BUCKET
  });
  console.log(`listening on :${port}`);
  console.log(`Using adapter: ${adapterType}`);
  console.log(`S3 Bucket: ${process.env.S3_BUCKET}`);
  console.log(`S3 Prefix: ${process.env.S3_PREFIX || '(none)'}`);
});
