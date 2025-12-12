// app/src/routes/health.js
import express from "express";

const router = express.Router();

// GET / -> health check
router.get("/", (_req, res) => {
  res.json({ ok: true });
});

// GET /components -> component health details (NON-BASELINE)
router.get("/components", (req, res) => {
  const now = new Date().toISOString();
  const rawWindow = req.query?.windowMinutes;
  const windowMinutes = typeof rawWindow === "string" ? Number(rawWindow) : 60;
  const includeTimeline = req.query?.includeTimeline === "true";

  // Keep a minimal, schema-valid response.
  const components = [
    {
      id: "api",
      display_name: "Registry API",
      status: "ok",
      observed_at: now,
      timeline: includeTimeline ? [] : undefined,
      issues: [],
      logs: [],
    },
  ];

  return res.status(200).json({
    components,
    generated_at: now,
    window_minutes: Number.isFinite(windowMinutes) ? windowMinutes : 60,
  });
});

export default router;
