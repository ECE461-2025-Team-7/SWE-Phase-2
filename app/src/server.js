// app/src/server.js
import "dotenv/config";
import express from "express";
import uploadRouter from "./routes/upload.js";
import downloadRouter from "./routes/download.js";

const app = express();

app.use(express.json()); // parse JSON bodies

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/upload", uploadRouter);
app.use("/download", downloadRouter);

const port = process.env.PORT || 3100;
app.listen(port, () => {
  console.log(`listening on :${port}`);
});
