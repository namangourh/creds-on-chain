import { Router, Request, Response } from "express";
import { getAllProofsByWallet } from "../services/cidStore";
import { fetchProofAccount } from "../services/solanaVerifier";
import { fetchReport } from "../services/ipfsClient";
import { searchProfiles, seedFromProfiles } from "../services/embeddings";
import { SkillReport } from "../types";

const router = Router();

interface BrowseProfile {
  wallet: string;
  cid: string;
  price: number | null;
  skillReport: SkillReport;
}

/**
 * GET /api/search?q=<query>&limit=<n>
 *
 * Runs a semantic similarity search over all published profiles using QVAC's
 * local embedding model. The query string never leaves the machine — all
 * inference is on-device via @qvac/embed-llamacpp (falls back to TF-IDF cosine
 * when the QVAC package is not installed).
 *
 * The route first ensures the embedding store is seeded with the latest
 * profiles, then ranks them by cosine similarity to the query.
 */
router.get("/", async (req: Request, res: Response) => {
  const query = (req.query.q as string | undefined)?.trim();
  const limit = Math.min(parseInt((req.query.limit as string) || "10", 10), 50);

  if (!query) {
    res.status(400).json({ error: "Missing query parameter: q" });
    return;
  }

  const programId = process.env.PROGRAM_ID!;

  try {
    // ── Seed the embedding store with any profiles not yet indexed ───────────
    // This runs fast on subsequent calls because indexProfile() skips wallets
    // that are already in the store.
    const rows = await getAllProofsByWallet();
    const byWallet = new Map<string, { cid: string; nonce: number }[]>();
    for (const row of rows) {
      if (!byWallet.has(row.wallet)) byWallet.set(row.wallet, []);
      byWallet.get(row.wallet)!.push({ cid: row.cid, nonce: row.nonce });
    }

    const wallets = [...byWallet.keys()].slice(0, 50);
    const settled = await Promise.allSettled(
      wallets.map(async (wallet): Promise<BrowseProfile | null> => {
        const entries = byWallet.get(wallet)!;
        for (const { cid, nonce } of entries) {
          const onChain = await fetchProofAccount(wallet, programId, nonce);
          if (!onChain) continue;
          const skillReport = await fetchReport(cid);
          return { wallet, cid, price: Number(onChain.price), skillReport };
        }
        const { cid } = entries[0];
        try {
          const skillReport = await fetchReport(cid);
          return { wallet, cid, price: null, skillReport };
        } catch {
          return null;
        }
      })
    );

    const profiles: BrowseProfile[] = settled
      .filter((r): r is PromiseFulfilledResult<BrowseProfile> =>
        r.status === "fulfilled" && r.value !== null
      )
      .map(r => r.value);

    // Seed store without blocking the search response on slow IPFS calls
    seedFromProfiles(profiles).catch(e =>
      console.warn("[search] seed error:", e?.message)
    );

    // ── Run semantic search ──────────────────────────────────────────────────
    const ranked = await searchProfiles(query, limit);

    res.json(ranked);
  } catch (err: any) {
    console.error("[search] error:", err.message);
    res.status(500).json({ error: "Search failed." });
  }
});

export default router;
