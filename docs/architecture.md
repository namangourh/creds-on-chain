# CredChain — Architecture (C4 Diagrams)

Four levels of C4 diagrams rendered natively by GitHub via Mermaid.

---

## Level 1 — System Context

Who uses CredChain and what external systems does it talk to?

```mermaid
C4Context
  title System Context — CredChain

  Person(candidate, "Candidate", "Uploads their resume or GitHub profile to generate a verifiable skill passport")
  Person(recruiter, "Recruiter", "Browses profiles, pays SOL to unlock full skill reports")

  System(credchain, "CredChain", "AI Skill Passport platform. Runs local AI, anchors proofs on Solana, stores reports on IPFS")

  System_Ext(solana, "Solana Devnet", "Public blockchain. Stores tamper-proof SHA-256 hashes of skill reports via an Anchor smart contract")
  System_Ext(ipfs, "IPFS / Pinata", "Decentralised content storage. Hosts encrypted skill report JSON by CID")
  System_Ext(github, "GitHub API", "Provides repository and contribution data when a candidate registers via GitHub username")
  System_Ext(phantom, "Phantom Wallet", "Browser wallet extension. Signs transactions and identifies users by public key")

  Rel(candidate, credchain, "Uploads resume / GitHub, connects wallet")
  Rel(recruiter, credchain, "Browses profiles, pays SOL to unlock")
  Rel(credchain, solana, "Registers proof PDA, verifies payment tx")
  Rel(credchain, ipfs, "Pins and fetches skill report JSON")
  Rel(credchain, github, "Fetches repos and readme via REST API")
  Rel(candidate, phantom, "Signs registration & proof transactions")
  Rel(recruiter, phantom, "Signs SOL unlock payment")
```

---

## Level 2 — Container Diagram

What are the deployable units inside CredChain?

```mermaid
C4Container
  title Container Diagram — CredChain

  Person(candidate, "Candidate")
  Person(recruiter, "Recruiter")

  System_Ext(solana, "Solana Devnet")
  System_Ext(ipfs, "IPFS / Pinata")
  System_Ext(github, "GitHub API")
  System_Ext(supabase, "Supabase (Postgres)", "Lightweight index: maps wallet → CID + nonce for fast profile lookup")
  System_Ext(openai, "OpenAI API", "Fallback only — used when QVAC packages are not installed")

  System_Boundary(credchain, "CredChain") {
    Container(spa, "React SPA", "React 19, TypeScript, Vite", "Single-page app. Landing, Browse, Upload, and Profile pages. Hosted on Vercel.")
    Container(api, "Express API", "Node.js, TypeScript", "REST backend. Orchestrates AI, IPFS, Solana, and DB operations. Hosted on Render.")
    Container(anchor, "Anchor Program", "Rust, Solana", "On-chain smart contract. Instructions: addProof, payToUnlock. Deployed to Solana Devnet.")
    Container(qvac, "QVAC Runtime", "Bare / Node.js", "Local AI engine. Runs LLM, OCR, embeddings, translation, STT, and TTS entirely on the server's hardware.")
  }

  Rel(candidate, spa, "Uses browser", "HTTPS")
  Rel(recruiter, spa, "Uses browser", "HTTPS")
  Rel(spa, api, "API calls", "REST/JSON over HTTPS")
  Rel(api, qvac, "Invokes AI tasks", "In-process Node.js")
  Rel(api, solana, "RPC calls", "JSON-RPC")
  Rel(api, ipfs, "Pin/fetch reports", "HTTPS")
  Rel(api, github, "Fetch user data", "HTTPS")
  Rel(api, supabase, "Read/write proof index", "Postgres TCP")
  Rel(api, openai, "Fallback LLM/embed", "HTTPS (optional)")
  Rel(spa, anchor, "Submit transactions via Wallet", "Solana web3.js")
  Rel(anchor, solana, "Deployed on", "")
```

---

## Level 3 — Component Diagram: Express API

What are the internal components of the backend?

```mermaid
C4Component
  title Component Diagram — Express API Backend

  Container_Ext(spa, "React SPA", "Calls REST endpoints")
  Container_Ext(qvac, "QVAC Runtime", "Local AI inference")
  System_Ext(solana, "Solana Devnet")
  System_Ext(ipfs, "IPFS / Pinata")
  System_Ext(supabase, "Supabase")
  System_Ext(openai, "OpenAI (fallback)")

  Container_Boundary(api, "Express API") {
    Component(upload, "Upload Route", "/api/upload", "Accepts PDF, image, or GitHub URL. Chains OCR → LLM → IPFS pin → DB write")
    Component(register, "Register Route", "/api/register", "Saves proof CID+nonce to Supabase after on-chain registration")
    Component(profile, "Profile Route", "/api/profile", "Fetches skill report from IPFS + unlock price from Solana PDA")
    Component(profiles, "Profiles Route", "/api/profiles", "Lists all registered profiles with public skill data")
    Component(unlock, "Unlock Route", "/api/unlock", "Verifies on-chain SOL payment, issues short-lived JWT")
    Component(report, "Report Route", "/api/report", "Serves full decrypted report — requires valid JWT")
    Component(search, "Search Route", "/api/search", "Embeds query, runs cosine similarity against in-memory vector store")
    Component(translate, "Translate Route", "/api/translate", "Translates report summary into target language via QVAC NMT")
    Component(speech, "Speech Route", "/api/speech", "Capabilities check, STT transcription, TTS synthesis endpoints")

    Component(aiAnalyzer, "AI Analyzer", "aiAnalyzer.ts", "Calls QVAC LLM (Mistral-7B) or OpenAI to extract skills, summary, score")
    Component(ocrExtractor, "OCR Extractor", "ocrExtractor.ts", "Runs QVAC OCR (ONNX) on images/scanned PDFs")
    Component(embeddings, "Embeddings Store", "embeddings.ts", "Maintains in-memory vector store using QVAC embeddings or TF-IDF fallback")
    Component(translator, "Translator", "translator.ts", "QVAC NMT translation with OpenAI fallback")
    Component(speechService, "Speech Service", "speechService.ts", "Lazy-loads Whisper STT and Chatterbox TTS QVAC addons")
    Component(solanaVerifier, "Solana Verifier", "solanaVerifier.ts", "Verifies payment tx and reads unlock price from on-chain PDA")
    Component(ipfsClient, "IPFS Client", "ipfsClient.ts", "Pins/fetches JSON via Pinata API")
    Component(githubFetcher, "GitHub Fetcher", "githubFetcher.ts", "Fetches repos and readmes from GitHub REST API")
  }

  Rel(spa, upload, "POST /api/upload")
  Rel(spa, register, "POST /api/register")
  Rel(spa, profile, "GET /api/profile/:wallet")
  Rel(spa, profiles, "GET /api/profiles")
  Rel(spa, unlock, "POST /api/unlock")
  Rel(spa, report, "GET /api/report/:cid")
  Rel(spa, search, "POST /api/search")
  Rel(spa, translate, "POST /api/translate")
  Rel(spa, speech, "GET /api/speech/capabilities, POST /api/speech/tts")

  Rel(upload, aiAnalyzer, "Analyse text")
  Rel(upload, ocrExtractor, "Extract text from image")
  Rel(upload, githubFetcher, "Fetch GitHub data")
  Rel(upload, ipfsClient, "Pin report")
  Rel(search, embeddings, "Query vectors")
  Rel(register, embeddings, "Index new profile")
  Rel(translate, translator, "Translate text")
  Rel(speech, speechService, "STT / TTS")
  Rel(unlock, solanaVerifier, "Verify payment")
  Rel(profile, solanaVerifier, "Read PDA price")
  Rel(profile, ipfsClient, "Fetch report")

  Rel(aiAnalyzer, qvac, "LLM inference")
  Rel(ocrExtractor, qvac, "OCR inference")
  Rel(embeddings, qvac, "Embed vectors")
  Rel(translator, qvac, "NMT translation")
  Rel(speechService, qvac, "STT / TTS inference")
  Rel(aiAnalyzer, openai, "Fallback")
  Rel(solanaVerifier, solana, "RPC")
  Rel(ipfsClient, ipfs, "Pin/fetch")
  Rel(upload, supabase, "Write CID+nonce")
  Rel(profile, supabase, "Read CID+nonce")
```

---

## Level 3 — Component Diagram: React SPA

What are the internal pages and shared modules of the frontend?

```mermaid
C4Component
  title Component Diagram — React SPA Frontend

  System_Ext(api, "Express API Backend")
  System_Ext(solana, "Solana Devnet / Phantom Wallet")

  Container_Boundary(spa, "React SPA") {
    Component(landing, "Landing Page", "LandingPage.tsx", "Hero, feature cards, animated 3D Solana background, CTAs")
    Component(browse, "Browse Page", "BrowsePage.tsx", "Profile grid with semantic search bar. Queries /api/search.")
    Component(upload, "Upload Page", "UploadPage.tsx", "Resume/GitHub upload wizard. Calls /api/upload then guides on-chain registration.")
    Component(profile, "Profile Page", "ProfilePage.tsx", "Public profile view. Pay-to-unlock flow. Multilingual summary. TTS Read Report button (English).")

    Component(apiLib, "API Client", "lib/api.ts", "Typed fetch wrappers for all backend endpoints")
    Component(speechLib, "Speech Lib", "lib/speech.ts", "TTS: QVAC backend first, browser SpeechSynthesis fallback")
    Component(solanaLib, "Solana Lib", "lib/solana.ts", "Transaction builders for addProof and payToUnlock instructions")
    Component(themeLib, "Theme", "lib/theme.ts", "Dark/light mode context")

    Component(walletCtx, "Wallet Context", "@solana/wallet-adapter-react", "Provides connected wallet public key and signTransaction")
    Component(router, "Router", "react-router-dom", "Client-side routing: /, /browse, /upload, /profile/:wallet")
  }

  Rel(landing, router, "Navigates to /upload, /browse")
  Rel(browse, apiLib, "GET /api/profiles, POST /api/search")
  Rel(upload, apiLib, "POST /api/upload, POST /api/register")
  Rel(upload, solanaLib, "Build addProof tx")
  Rel(upload, walletCtx, "Sign and send tx")
  Rel(profile, apiLib, "GET /api/profile, POST /api/unlock, GET /api/report, POST /api/translate")
  Rel(profile, solanaLib, "Build payToUnlock tx")
  Rel(profile, walletCtx, "Sign and send tx")
  Rel(profile, speechLib, "TTS synthesis")
  Rel(apiLib, api, "REST/JSON")
  Rel(solanaLib, solana, "web3.js RPC + tx")
  Rel(walletCtx, solana, "Phantom adapter")
```

---

## Level 4 — Code: Upload & Registration Flow

Sequence of calls when a candidate uploads a resume and registers on-chain.

```mermaid
sequenceDiagram
  actor C as Candidate
  participant UI as React SPA
  participant API as Express API
  participant OCR as QVAC OCR
  participant LLM as QVAC LLM
  participant IPFS as Pinata / IPFS
  participant DB as Supabase
  participant Chain as Solana (Anchor)

  C->>UI: Upload PDF / image / GitHub URL
  UI->>API: POST /api/upload (multipart)
  API->>OCR: Extract text (if image/scanned PDF)
  OCR-->>API: Plain text
  API->>LLM: Analyse text → skills, summary, score
  LLM-->>API: SkillReport JSON
  API->>IPFS: Pin SkillReport JSON
  IPFS-->>API: CID
  API->>DB: INSERT (wallet, CID, nonce)
  API-->>UI: { cid, nonce, skillReport }

  UI->>Chain: addProof(sha256(report), nonce) via Phantom
  Chain-->>UI: tx signature
  UI->>API: POST /api/register { wallet, cid, nonce, txSig }
  API-->>UI: { success: true }
```

---

## Level 4 — Code: Recruiter Unlock Flow

```mermaid
sequenceDiagram
  actor R as Recruiter
  participant UI as React SPA
  participant API as Express API
  participant Chain as Solana (Anchor)
  participant IPFS as IPFS / Pinata

  R->>UI: Click "Unlock Report" on profile page
  UI->>API: GET /api/profile/:wallet
  API->>Chain: Fetch Proof PDA (price, hash)
  Chain-->>API: { price_lamports, hash }
  API-->>UI: { price, skillReport (public preview) }

  UI->>Chain: payToUnlock(owner, price) via Phantom
  Chain-->>UI: tx signature

  UI->>API: POST /api/unlock { wallet, txSig }
  API->>Chain: Verify payment tx on-chain
  Chain-->>API: Payment confirmed
  API-->>UI: JWT (short-lived)

  UI->>API: GET /api/report/:cid (Authorization: Bearer JWT)
  API->>IPFS: Fetch full report JSON by CID
  IPFS-->>API: SkillReport JSON
  API-->>UI: Full SkillReport
  UI->>R: Display full skills, summary, TTS button
```
