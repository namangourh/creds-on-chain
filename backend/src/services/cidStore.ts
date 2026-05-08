import { getPool } from "./db";

interface ProofEntry {
  cid: string;
  nonce: number;
}

export async function addProof(wallet: string, cid: string, nonce: number): Promise<void> {
  await getPool().query(
    "INSERT INTO proofs (wallet, cid, nonce) VALUES ($1, $2, $3)",
    [wallet.toLowerCase(), cid, nonce]
  );
}

export async function getLatestProof(wallet: string): Promise<ProofEntry | undefined> {
  const result = await getPool().query<ProofEntry>(
    "SELECT cid, nonce FROM proofs WHERE wallet = $1 ORDER BY nonce DESC LIMIT 1",
    [wallet.toLowerCase()]
  );
  return result.rows[0];
}

export async function getAllProofs(wallet: string): Promise<ProofEntry[]> {
  const result = await getPool().query<ProofEntry>(
    "SELECT cid, nonce FROM proofs WHERE wallet = $1 ORDER BY nonce DESC",
    [wallet.toLowerCase()]
  );
  return result.rows;
}
