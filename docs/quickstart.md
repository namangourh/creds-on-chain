# CredChain — Quick Start Guide

Get CredChain running locally in under 10 minutes.

> **Prerequisites:** Node.js 18+, Git, a [Phantom wallet](https://phantom.app) browser extension set to **Solana Devnet**.

---

## 1. Clone the Repository

```bash
git clone https://github.com/namangourh/creds-on-chain.git
cd creds-on-chain
```

---

## 2. Set Up the Backend

### Install dependencies

```bash
cd backend
npm install
```

### Create `backend/.env`

```env
# Solana
SOLANA_RPC_URL=https://api.devnet.solana.com
PROGRAM_ID=2SysoLkkPBto76Yq8NmSgwr5nMsZNpAXWeGRFBY4E8JJ

# IPFS (get free keys at https://app.pinata.cloud)
PINATA_API_KEY=your_pinata_api_key
PINATA_API_SECRET=your_pinata_api_secret

# Database (Supabase — see Step 3)
DATABASE_URL=postgresql://postgres:[password]@[host]:5432/postgres

# Auth
JWT_SECRET=any_long_random_string
JWT_EXPIRES_IN=3600

# Server
PORT=3001
FRONTEND_URL=http://localhost:5173
NODE_ENV=development

# AI fallback — only needed if QVAC packages are NOT installed
OPENAI_API_KEY=sk-...
```

### Start the backend

```bash
npm run dev
# Backend running at http://localhost:3001
```

---

## 3. Set Up Supabase

1. Create a free project at [supabase.com](https://supabase.com)
2. Copy your **Postgres connection string** into `DATABASE_URL` above
3. Run this once in the **SQL Editor**:

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

## 4. Set Up the Frontend

### Install dependencies

```bash
cd ../frontend
npm install
```

### Create `frontend/.env`

```env
VITE_BACKEND_URL=http://localhost:3001
VITE_SOLANA_RPC_URL=https://api.devnet.solana.com
VITE_PROGRAM_ID=2SysoLkkPBto76Yq8NmSgwr5nMsZNpAXWeGRFBY4E8JJ
```

### Start the frontend

```bash
npm run dev
# App running at http://localhost:5173
```

---

## 5. Configure Phantom Wallet

1. Install [Phantom](https://phantom.app) if you haven't already
2. Open Phantom → Settings → **Developer Settings** → Switch to **Devnet**
3. Get free Devnet SOL from the [Solana Faucet](https://faucet.solana.com) (you need ~0.1 SOL to register)

---

## 6. Register a Skill Passport

1. Open `http://localhost:5173` and click **Connect Wallet**
2. Navigate to **Upload** → paste your **GitHub username** or upload a **PDF resume**
3. Wait for QVAC to analyse your profile (~10–30 s locally)
4. Review your generated skill report, then click **Register On-Chain**
5. Approve the Phantom transaction — your proof is now anchored on Solana Devnet

---

## 7. Browse & Unlock

- Go to `/browse` to see all registered profiles
- Use the **semantic search** bar to find profiles by skill description
- Click **View Profile** → **Unlock Report** to pay SOL and see the full report
- On your own profile, full report is always free — click **View My Full Report**
- Switch the language selector to translate the summary (15 languages)
- Click **Read** (English only) to hear the report read aloud via QVAC TTS

---

## Optional: Install QVAC Packages for Full Local AI

By default the backend falls back to OpenAI. To run 100% on-device:

```bash
cd backend
npm install @qvac/llm-llamacpp @qvac/embed-llamacpp @qvac/ocr-onnx @qvac/translation-nmtcpp
```

Then download the required model files and place them in `backend/models/`. See the [QVAC documentation](https://docs.qvac.tether.io) for model download instructions.

| QVAC Package | Model needed | Size |
|---|---|---|
| `@qvac/llm-llamacpp` | `mistral-7b-instruct-v0.2.Q4_K_M.gguf` | ~4 GB |
| `@qvac/embed-llamacpp` | `nomic-embed-text.gguf` | ~274 MB |
| `@qvac/ocr-onnx` | ONNX OCR model bundle | ~50 MB |
| `@qvac/translation-nmtcpp` | NMT model bundle (15 languages) | ~300 MB |

> When QVAC packages are installed the backend logs `QVAC [feature] ready` on startup. If they're absent it logs a warning and falls back gracefully — the app remains fully functional.

---

## Troubleshooting

| Issue | Fix |
|---|---|
| `VITE_BACKEND_URL` not set | Add it to `frontend/.env` and restart Vite |
| Phantom shows wrong network | Switch Phantom to **Devnet** in Developer Settings |
| `Transaction simulation failed` | Airdrop more Devnet SOL from [faucet.solana.com](https://faucet.solana.com) |
| Profile not showing after registration | Wait 5–10 s for the embedding index to update, then refresh `/browse` |
| QVAC module not found | The app falls back to OpenAI automatically — set `OPENAI_API_KEY` in backend `.env` |
| TTS button not visible | The Read button only appears when **English** is selected in the language dropdown |

---

## Project Structure

```
creds-on-chain/
├── frontend/                  # React 19 SPA (Vite)
│   └── src/
│       ├── pages/             # LandingPage, BrowsePage, UploadPage, ProfilePage
│       ├── components/        # SkillTag, ScoreRing, SkillRadar, ShareButton, …
│       └── lib/               # api.ts, solana.ts, speech.ts, theme.ts
├── backend/                   # Express API (Node.js + TypeScript)
│   └── src/
│       ├── routes/            # upload, register, profile, unlock, search, translate, speech, …
│       └── services/          # aiAnalyzer, ocrExtractor, embeddings, translator, speechService, …
├── programs/                  # Anchor smart contract (Rust)
│   └── ai-skill-passport/
└── docs/                      # Architecture diagrams and guides
    ├── architecture.md        # C4 diagrams (this file's companion)
    └── quickstart.md          # This file
```

---

## Further Reading

- [Architecture & C4 Diagrams](./architecture.md)
- [QVAC Documentation](https://docs.qvac.tether.io)
- [Anchor Framework](https://www.anchor-lang.com)
- [Solana Devnet Explorer](https://explorer.solana.com/?cluster=devnet)
