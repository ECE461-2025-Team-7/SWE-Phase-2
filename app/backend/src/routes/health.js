// app/src/routes/health.js
import express from "express";

const router = express.Router();

// GET / -> health check
router.get("/", (_req, res) => {
	res.json({ ok: true });
});

export default router;