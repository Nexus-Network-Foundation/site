// tools/sign.mjs — sign devlog entries with the agent key. Run by hand, never in CI:
//
//   node tools/sign.mjs [--resign <id>]…        (finds a built tet-agent-sdk; see tools/agent-key.mjs)
//
// The key comes from the macOS Keychain at sign time (tools/agent-key.mjs), never from a file.
//
// Signs every entry that has no sidecar in sigs/. It will NOT re-sign an entry whose signature has
// stopped verifying unless that entry is named with --resign: a tool that quietly re-signs whatever
// changed would turn "this entry was edited after signing" into "this entry is signed", which is the
// one thing the build check exists to catch.
//
// The signer is the TET agent SDK (branch agent-identity), not a copy of it here, so the bytes are the
// ones tet-core is tested to reproduce. The chain binding comes from files/tet-verify/pin.json, and the
// key must be the pinned one; a different mnemonic is refused rather than producing signatures the
// site would reject.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { entryId, entryPayloadBytes, mldsa44KeyId, DEVLOG_PAYLOAD_TYPE, verifyEntry } from '../files/tet-verify/verify.mjs';
import { loadPosts, loadPqc, readPin } from './devlog-sigs.mjs';
import { loadAgent } from './agent-key.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const resign = new Set(process.argv.flatMap((a, i, all) => (all[i - 1] === '--resign' ? [a] : [])));

const pin = readPin(root);
if (!pin) throw new Error('files/tet-verify/pin.json is missing: run tools/pin.mjs first');
const { wallet, signPayloadEnvelope } = await loadAgent();
const edHex = wallet.walletIdHex64.trim().toLowerCase();
const mlKeyId = await mldsa44KeyId(wallet.mldsa44PubkeyB64);
if (edHex !== pin.agent_ed25519_pubkey_hex || mlKeyId !== pin.agent_mldsa44_keyid) {
  throw new Error(`this key is not the pinned agent key (got ${edHex.slice(0, 12)}…, pinned ${pin.agent_ed25519_pubkey_hex.slice(0, 12)}…)`);
}

const chain = { chainId: pin.chain_id, genesisHash: pin.genesis_hash };
const pqc = await loadPqc(root);
const dir = path.join(root, 'sigs');
fs.mkdirSync(dir, { recursive: true });
let signed = 0, kept = 0;
const refused = [];
for (const p of loadPosts(root)) {
  const id = entryId(p);
  const f = path.join(dir, `${id}.sig.json`);
  if (fs.existsSync(f) && !resign.has(id)) {
    const r = await verifyEntry(p, JSON.parse(fs.readFileSync(f, 'utf8')), pin, pqc);
    if (r.ok) { kept++; continue; }
    refused.push(`${id}: ${r.reason}`);
    continue;
  }
  const env = await signPayloadEnvelope(wallet, DEVLOG_PAYLOAD_TYPE, entryPayloadBytes(p), chain);
  const check = await verifyEntry(p, env, pin, pqc);
  if (!check.ok) throw new Error(`${id}: fresh signature does not verify here (${check.reason}); the SDK and the site verifier disagree`);
  fs.writeFileSync(f, JSON.stringify(env, null, 2) + '\n');
  signed++;
  console.log(`signed  ${id}`);
}
console.log(`${signed} signed, ${kept} already valid`);
if (refused.length) {
  console.error(`\nNot re-signed, because they changed after signing. If the edit is yours, re-run with --resign <id>:\n  ${refused.join('\n  ')}`);
  process.exit(1);
}
