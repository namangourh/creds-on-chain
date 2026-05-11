import { SkillReport } from "../types";

// ─── In-memory vector store ───────────────────────────────────────────────────
// Maps wallet address → { vector, skillReport, cid, price }
// Vectors are produced by QVAC's local embedding model so no data ever leaves
// the machine. On restart the store re-populates lazily as profiles are queried.

interface EmbeddedProfile {
  wallet: string;
  cid: string;
  price: number | null;
  skillReport: SkillReport;
  vector: number[];
}

const store = new Map<string, EmbeddedProfile>();

// ─── QVAC Embeddings client ───────────────────────────────────────────────────
// @qvac/embed-llamacpp runs fully on-device — no API key, no cloud call.
// The model is downloaded once and cached locally by the QVAC runtime.
let embedder: any | null = null;

async function getEmbedder() {
  if (!embedder) {
    try {
      // Dynamic import so the rest of the backend starts normally even if
      // the QVAC package is not yet installed (graceful degradation).
      const { Embedder } = await import("@qvac/embed-llamacpp");
      embedder = new Embedder({ model: "nomic-embed-text" });
      await embedder.init();
      console.log("[embeddings] QVAC embedder ready (local, on-device)");
    } catch (e: any) {
      console.warn(
        "[embeddings] QVAC embed package unavailable — falling back to TF-IDF cosine.",
        e?.message
      );
      embedder = null;
    }
  }
  return embedder;
}

// ─── Fallback: lightweight TF-IDF bag-of-words vector ────────────────────────
// Used when the QVAC package hasn't been installed yet, so the search feature
// degrades gracefully to keyword cosine similarity rather than crashing.

function tfidfVector(text: string, vocab: string[]): number[] {
  const words = text.toLowerCase().split(/\W+/);
  return vocab.map(term => words.filter(w => w === term).length);
}

function buildVocab(texts: string[]): string[] {
  const set = new Set<string>();
  for (const t of texts) t.toLowerCase().split(/\W+/).forEach(w => w && set.add(w));
  return [...set];
}

function dotProduct(a: number[], b: number[]): number {
  return a.reduce((s, v, i) => s + v * b[i], 0);
}

function magnitude(v: number[]): number {
  return Math.sqrt(v.reduce((s, x) => s + x * x, 0));
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const mag = magnitude(a) * magnitude(b);
  return mag === 0 ? 0 : dotProduct(a, b) / mag;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Converts a SkillReport to a single text corpus for embedding. */
function reportToText(report: SkillReport): string {
  return `${report.skills.join(" ")} ${report.summary}`;
}

/**
 * Embed a single text string into a vector.
 * Uses QVAC local model when available, falls back to keyword vector.
 */
async function embed(text: string, fallbackVocab?: string[]): Promise<number[]> {
  const e = await getEmbedder();
  if (e) {
    return e.embed(text) as Promise<number[]>;
  }
  // Fallback: vocab built from all stored profiles for consistent dimensions
  const vocab = fallbackVocab ?? buildVocabFromStore();
  return tfidfVector(text, vocab);
}

function buildVocabFromStore(): string[] {
  const allTexts = [...store.values()].map(p => reportToText(p.skillReport));
  return buildVocab(allTexts);
}

/**
 * Store (or update) a profile's embedding in the in-memory vector store.
 * Called from the upload/register pipeline so new profiles are immediately searchable.
 */
export async function indexProfile(
  wallet: string,
  cid: string,
  price: number | null,
  skillReport: SkillReport
): Promise<void> {
  const text = reportToText(skillReport);
  const vocab = buildVocabFromStore();
  const vector = await embed(text, vocab);
  store.set(wallet, { wallet, cid, price, skillReport, vector });
  console.log(`[embeddings] Indexed profile for ${wallet.slice(0, 8)}…`);
}

/**
 * Semantic search: returns profiles ranked by cosine similarity to the query.
 * All inference is local — the query text never leaves the machine.
 */
export async function searchProfiles(
  query: string,
  topK = 10
): Promise<Array<{ wallet: string; cid: string; price: number | null; skillReport: SkillReport; score: number }>> {
  if (store.size === 0) return [];

  const vocab = buildVocabFromStore();
  const queryVec = await embed(query, vocab);

  // Re-embed all stored profiles with the same (possibly updated) vocab when
  // using the TF-IDF fallback, since vocab grows as profiles are added.
  const e = await getEmbedder();
  const results = await Promise.all(
    [...store.values()].map(async (p) => {
      const vec = e ? p.vector : tfidfVector(reportToText(p.skillReport), vocab);
      const score = cosineSimilarity(queryVec, vec);
      return { ...p, score };
    })
  );

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .filter(r => r.score > 0);
}

/** Bulk-seed the store from profiles already fetched by the browse route. */
export async function seedFromProfiles(
  profiles: Array<{ wallet: string; cid: string; price: number | null; skillReport: SkillReport }>
): Promise<void> {
  for (const p of profiles) {
    if (!store.has(p.wallet)) {
      await indexProfile(p.wallet, p.cid, p.price, p.skillReport);
    }
  }
}
