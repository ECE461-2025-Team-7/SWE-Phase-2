// app/src/routes/tracks.js
import express from "express";

const router = express.Router();

// GET / -> return planned tracks. We're implementing the Access control track per spec.
router.get("/", (_req, res) => {
    try {
        const plannedTracks = ["Access control track"];
        return res.status(200).json({ plannedTracks });
    } catch (err) {
        // In case of unexpected errors
        return res.status(500).json({ error: "Failed to retrieve tracks" });
    }
});

export default router;