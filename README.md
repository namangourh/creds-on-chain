# CredChain

Upload your resume or GitHub profile — AI extracts your creds, stores the report on IPFS, and anchors a tamper-proof hash on Solana. Recruiters pay SOL to unlock your full cred report; you earn directly to your wallet.

All AI runs **locally on-device** via [QVAC](https://qvac.ai) — no cloud API, no data leakage, no subscription.

---

## How it works

1. **Upload** a PDF resume, a scanned image, or enter a GitHub username
2. **Local AI Analysis** — QVAC (`@qvac/llm-llamacpp`) extracts skills, writes a summary, and scores your profile (0–100) entirely on-device
3. **IPFS Storage** — the skill report is pinned to IPFS via Pinata (permanent, censorship-resistant)
4. **On-Chain Proof** — the SHA-256 hash is anchored on Solana Devnet via an Anchor smart contract
5. **Pay-to-Unlock** — viewers pay SOL to unlock the full report; payment is verified on-chain before a JWT is issued

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript + Vite |
| Backend | Node.js + Express + TypeScript |
| Local AI | QVAC (`@qvac/llm-llamacpp`, `@qvac/embed-llamacpp`, `@qvac/ocr-onnx`, `@qvac/translation-nmtcpp`) |
| AI Fallback | OpenAI GPT-4o-mini (used only when QVAC packages are not installed) |
| Storage | IPFS via Pinata |
| Database | Supabase (Postgres) |
| Blockchain | Solana Devnet + Anchor smart contract |
| Wallet | Phantom (via Wallet Standard) |
| 3D / Animation | Three.js + React Three Fiber + Framer Motion |

---

## QVAC Integration

CredChain uses [QVAC](https://qvac.ai) — Tether's decentralized, local-first AI platform — across four capabilities. All inference runs on the server's hardware with no data leaving the machine.

### 1. Local LLM Inference — `@qvac/llm-llamacpp`

**File:** `backend/src/services/aiAnalyzer.ts`

Replaces the OpenAI API call for resume and GitHub skill extraction. Uses `mistral-7b-instruct-v0.2` loaded locally by the QVAC runtime. Falls back to `gpt-4o-mini` gracefully if the package is not installed.

```
Resume / GitHub text → QVAC LLM (on-device) → { skills, summary, score }
```

### 2. OCR for Scanned Resumes — `@qvac/ocr-onnx`

**File:** `backend/src/services/ocrExtractor.ts`

Extends the upload pipeline to accept image files (JPEG, PNG, TIFF) and image-only scanned PDFs. Text is extracted on-device before being passed to the LLM — no cloud OCR service required.

```
Scanned PDF / Image → QVAC OCR (on-device) → plain text → QVAC LLM → SkillReport
```

Supported upload formats: `PDF`, `JPEG`, `PNG`, `TIFF`, `BMP`, `WebP`

### 3. Semantic Search — `@qvac/embed-llamacpp`

**Files:** `backend/src/services/embeddings.ts`, `backend/src/routes/search.ts`

Powers the Browse page search bar. Profiles are embedded into vectors using a local `nomic-embed-text` model. Queries are embedded the same way and ranked by cosine similarity — entirely on-device. Falls back to TF-IDF cosine similarity when the QVAC package is not installed.

```
Search query → QVAC Embedder (on-device) → cosine similarity → ranked profiles
```

New profiles are indexed automatically in the background when a credential is registered (`/api/register`), so search results are always up to date.

### 4. Multilingual Translation — `@qvac/translation-nmtcpp`

**Files:** `backend/src/services/translator.ts`, `backend/src/routes/translate.ts`

Translates skill report summaries into 15 languages on the profile page. Uses a local NMT (Neural Machine Translation) model. A language selector with a **"QVAC local"** badge appears in the unlocked report view. Supported languages include Spanish, French, German, Portuguese, Italian, Dutch, Russian, Chinese, Japanese, Korean, Arabic, Hindi, Turkish, and Polish.

```
English summary → QVAC NMT (on-device) → translated summary (in browser)
```

---

## Running Locally

### Prerequisites

- Node.js 18+
- A Phantom wallet browser extension set to Solana Devnet

### Backend

```bash
cd backend
npm install
# create backend/.env with the required variables (see below)
npm run dev
```

### Frontend

```bash
cd frontend
npm install
# create frontend/.env with the required variables (see below)
npm run dev
```

App runs at `http://localhost:5173`, backend at `http://localhost:3001`.

### Environment Variables

**`backend/.env`**
```
# Required for OpenAI fallback (optional if QVAC packages are installed)
OPENAI_API_KEY=

PINATA_API_KEY=
PINATA_API_SECRET=
SOLANA_RPC_URL=
PROGRAM_ID=2SysoLkkPBto76Yq8NmSgwr5nMsZNpAXWeGRFBY4E8JJ
JWT_SECRET=
JWT_EXPIRES_IN=3600
PORT=3001
DATABASE_URL=
FRONTEND_URL=*
NODE_ENV=development
```

**`frontend/.env`**
```
VITE_BACKEND_URL=http://localhost:3001
VITE_SOLANA_RPC_URL=
VITE_PROGRAM_ID=2SysoLkkPBto76Yq8NmSgwr5nMsZNpAXWeGRFBY4E8JJ
```

### Supabase Setup

Run this once in your Supabase SQL Editor:

```sql
CREATE TABLE IF NOT EXISTS proofs (
  id         SERIAL PRIMARY KEY,
  wallet     TEXT NOT NULL,
  cid        TEXT NOT NULL,
  nonce      BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_proofs_wallet ON proofs (wallet);
```

---

## Smart Contract

- **Network:** Solana Devnet
- **Program ID:** `2SysoLkkPBto76Yq8NmSgwr5nMsZNpAXWeGRFBY4E8JJ`
- **Instructions:** `addProof` (register skill report hash) · `payToUnlock` (pay owner to unlock report)
- **PDA seeds:** `["proof", owner_pubkey, nonce_u64_le]`

---

## Deployment

Backend → [Render](https://render.com) · Frontend → [Vercel](https://vercel.com)

Set all environment variables in your hosting dashboards before deploying. The production frontend build will fail with a clear error if `VITE_BACKEND_URL` is not configured.
