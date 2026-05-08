import express from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

import { validateEnv } from "./services/validateEnv";
validateEnv();

import uploadRouter from "./routes/upload";
import registerRouter from "./routes/register";
import profileRouter from "./routes/profile";
import unlockRouter from "./routes/unlock";
import reportRouter from "./routes/report";

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());

app.use("/api/upload", uploadRouter);
app.use("/api/register", registerRouter);
app.use("/api/profile", profileRouter);
app.use("/api/unlock", unlockRouter);
app.use("/api/report", reportRouter);

// Health check
app.get("/health", (_req, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);

  // Self-ping every 10 min to prevent Render free tier from sleeping the container.
  // Only runs in production so local dev isn't affected.
  if (process.env.NODE_ENV === "production" && process.env.RENDER_EXTERNAL_URL) {
    const url = `${process.env.RENDER_EXTERNAL_URL}/health`;
    setInterval(async () => {
      try {
        await fetch(url);
        console.log("[keep-alive] pinged", url);
      } catch (e) {
        console.warn("[keep-alive] ping failed:", (e as Error).message);
      }
    }, 10 * 60 * 1000);
  }
});
