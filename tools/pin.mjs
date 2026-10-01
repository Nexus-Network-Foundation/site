// tools/pin.mjs — write files/tet-verify/pin.json from the agent key and the chain it signs for.
//
//   TET_AGENT_SDK=… node tools/pin.mjs <chain_id> <genesis_hash>
//
// Only public values are written: the chain binding, the Ed25519 public key, and the SHA-256 keyid of
// the ML-DSA-44 public key. Run it again after a new genesis; every entry then has to be re-signed.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mldsa44KeyId } from '../files/tet-verify/verify.mjs';
import { loadAgent } from './agent-key.mjs';

const [chainId, genesisRaw] = process.argv.slice(2);
const genesisHash = String(genesisRaw ?? '').trim().toLowerCase();
if (!chainId || !/^(?:0x)?[0-9a-f]{64}$/.test(genesisHash)) {
  throw new Error('usage: node tools/pin.mjs <chain_id> <genesis_hash: 0x + 64 hex, exactly as the node uses it>');
}
const { wallet } = await loadAgent();
const pin = {
  chain_id: chainId,
  genesis_hash: genesisHash,
  agent_ed25519_pubkey_hex: wallet.walletIdHex64.trim().toLowerCase(),
  agent_mldsa44_keyid: await mldsa44KeyId(wallet.mldsa44PubkeyB64),
};
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
fs.writeFileSync(path.join(root, 'files', 'tet-verify', 'pin.json'), JSON.stringify(pin, null, 2) + '\n');
console.log(JSON.stringify(pin, null, 2));
