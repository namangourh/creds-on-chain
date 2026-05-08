# CredChain

Upload your resume or GitHub profile — AI extracts your creds, stores the report on IPFS, and anchors a tamper-proof hash on Solana. Recruiters pay SOL to unlock your full cred report; you earn directly to your wallet.

---

## How it works

1. **Upload** a PDF resume or enter a GitHub username
2. **AI Analysis** — GPT-4o-mini extracts skills, writes a summary, and scores your profile (0–100)
3. **IPFS Storage** — the skill report is pinned to IPFS via Pinata (permanent, censorship-resistant)
4. **On-Chain Proof** — the SHA-256 hash is anchored on Solana Devnet via an Anchor smart contract
5. **Pay-to-Unlock** — viewers pay SOL to unlock the full report; payment is verified on-chain before a JWT is issued

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript + Vite + Tailwind CSS v4 |
| Backend | Node.js + Express + TypeScript |
| AI | OpenAI GPT-4o-mini |
| Storage | IPFS via Pinata |
| Database | Supabase (Postgres) |
| Blockchain | Solana Devnet + Anchor smart contract |
| Wallet | Phantom (via Wallet Standard) |
| 3D / Animation | Three.js + React Three Fiber + Framer Motion |

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
