import { Router, Request, Response } from "express";
import { verifyAddProofTx } from "../services/solanaVerifier";
import { addProof } from "../services/cidStore";

const router = Router();

router.post("/", async (req: Request, res: Response) => {
  const { walletAddress, cid, txSignature, nonce } = req.body;

  if (!walletAddress || !cid || !txSignature || nonce === undefined) {
    res.status(400).json({ error: "walletAddress, cid, txSignature, and nonce are required." });
    return;
  }

  try {
    // Registration is only accepted after an on-chain tx ties this action to walletAddress.
    const valid = await verifyAddProofTx(txSignature, walletAddress);
    if (!valid) {
      res.status(400).json({ error: "Could not verify on-chain transaction." });
      return;
    }

    // Store nonce with CID so profile lookup can derive the same nonce-scoped PDA later.
    await addProof(walletAddress, cid, Number(nonce));
    res.json({ success: true });
  } catch (err: any) {
    console.error("[register] error:", err.message);
    res.status(500).json({ error: "Failed to register proof." });
  }
});

export default router;
