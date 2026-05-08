import { Router, Request, Response } from "express";
import multer from "multer";
import { parsePdf } from "../services/pdfParser";
import { fetchGithubProfile } from "../services/githubFetcher";
import { analyzeText } from "../services/aiAnalyzer";
import { uploadReport } from "../services/ipfsClient";
import { sha256Hex } from "../services/hashUtils";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      cb(new Error("Only PDF files are accepted."));
    } else {
      cb(null, true);
    }
  },
});

router.post("/", upload.single("file"), async (req: Request, res: Response) => {
  try {
    let text: string;

    // Accept exactly one source mode per request so downstream prompts stay consistent.
    if (req.file) {
      // Resume upload path
      text = await parsePdf(req.file.buffer);
    } else if (req.body?.githubUsername) {
      // GitHub path
      text = await fetchGithubProfile(req.body.githubUsername);
    } else {
      res.status(400).json({ error: "Provide a PDF file or githubUsername." });
      return;
    }

    const type = req.file ? "resume" : "github";
    // AI output is normalized into SkillReport before any persistence.
    const skillReport = await analyzeText(text, type);

    // Upload report JSON to IPFS
    const cid = await uploadReport(skillReport);

    // Hash exactly what will be reconstructed client-side with JSON.stringify(report).
    // This keeps the on-chain check deterministic across backend/frontend code paths.
    const jsonString = JSON.stringify(skillReport);
    const hash = sha256Hex(jsonString);

    res.json({ skillReport, cid, hash });
  } catch (err: any) {
    const status = err.statusCode || 500;
    res.status(status).json({ error: err.message || "Upload failed." });
  }
});

export default router;
