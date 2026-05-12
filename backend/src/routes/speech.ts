import { Router, Request, Response } from "express";
import multer from "multer";
import {
  isSttAvailable,
  isTtsAvailable,
  transcribeAudio,
  synthesizeSpeech,
  pcmToWav,
} from "../services/speechService";

const router = Router();

// Store audio in memory — recordings are short (< 30 s at most)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ─── GET /api/speech/capabilities ────────────────────────────────────────────
// Returns which QVAC speech features are available server-side.
// The frontend uses this to decide whether to show "QVAC voice" vs
// "browser speech" badges.
router.get("/capabilities", (_req: Request, res: Response) => {
  res.json({
    stt: isSttAvailable(),
    tts: isTtsAvailable(),
  });
});

// ─── POST /api/speech/transcribe ─────────────────────────────────────────────
// Accepts a WAV/PCM audio blob (field name: "audio").
// Returns { text: string }.
router.post(
  "/transcribe",
  upload.single("audio"),
  async (req: Request, res: Response) => {
    if (!req.file) {
      res.status(400).json({ error: "Missing audio file." });
      return;
    }

    const text = await transcribeAudio(req.file.buffer);
    if (text === null) {
      res
        .status(503)
        .json({ error: "QVAC Whisper not available on this server." });
      return;
    }

    res.json({ text });
  }
);

// ─── POST /api/speech/tts ─────────────────────────────────────────────────────
// Accepts { text: string }.
// Returns raw WAV audio (audio/wav) when QVAC TTS is available.
router.post("/tts", async (req: Request, res: Response) => {
  const { text } = req.body as { text?: string };
  if (!text || typeof text !== "string" || !text.trim()) {
    res.status(400).json({ error: "Missing or empty text." });
    return;
  }

  // Hard cap: synthesising very long text takes too long server-side.
  const truncated = text.slice(0, 800);

  const samples = await synthesizeSpeech(truncated);
  if (samples === null) {
    res
      .status(503)
      .json({ error: "QVAC TTS not available on this server." });
    return;
  }

  const wav = pcmToWav(samples);
  res.set("Content-Type", "audio/wav");
  res.set("Content-Length", String(wav.length));
  res.send(wav);
});

export default router;
