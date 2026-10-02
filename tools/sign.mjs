// tools/sign.mjs — sign devlog entries with the agent key. Run by hand, never in CI:
//
//   node tools/sign.mjs [--resign <id>]…        (finds a built tet-agent-sdk; see tools/agent-key.mjs)
//   node tools/sign.mjs --resign-all --previous-pin <old pin.json>
//
// --resign-all is for a new genesis (or a new agent key): pin.json has changed, so every existing
// signature stops verifying at once, and none of them can be told apart from an edit by the new pin.
// It therefore checks every entry against the PREVIOUS pin first and re-signs nothing unless all of
// them still verify there. An entry edited since its last signature is never re-signed this way;
// name it with --resign <id> once you have decided the edit is yours. The old pin is easiest to get
// from git before you overwrite it:  git show HEAD:files/tet-verify/pin.json > /tmp/old-pin.json
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
const argv = process.argv.slice(2);
const resign = new Set(argv.flatMap((a, i, all) => (all[i - 1] === '--resign' ? [a] : [])));
const resignAll = argv.includes('--resign-all');
const previousPinPath = argv[argv.indexOf('--previous-pin') + 1];
if (resignAll && (!argv.includes('--previous-pin') || !previousPinPath)) {
  throw new Error('--resign-all needs --previous-pin <file>: every entry is checked against the old pin before anything is re-signed');
}

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

if (resignAll) {
  // All or nothing: one entry that fails under the old pin stops the whole run, before any file changes.
  const previous = JSON.parse(fs.readFileSync(previousPinPath, 'utf8'));
  const bad = [];
  for (const p of loadPosts(root)) {
    const f = path.join(dir, `${entryId(p)}.sig.json`);
    if (!fs.existsSync(f)) { bad.push(`${entryId(p)}: no signature under the previous pin`); continue; }
    const r = await verifyEntry(p, JSON.parse(fs.readFileSync(f, 'utf8')), previous, pqc);
    if (!r.ok) bad.push(`${entryId(p)}: ${r.reason}`);
  }
  if (bad.length) {
    console.error(`--resign-all refused: ${bad.length} entr${bad.length === 1 ? 'y does' : 'ies do'} not verify under the previous pin, so re-signing would approve whatever changed:\n  ${bad.join('\n  ')}\nSign new entries normally and re-sign edited ones by name with --resign <id> first.`);
    process.exit(1);
  }
  for (const p of loadPosts(root)) resign.add(entryId(p));
  console.log(`all entries verify under the previous pin (${previous.chain_id}); re-signing for ${pin.chain_id}`);
}
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
