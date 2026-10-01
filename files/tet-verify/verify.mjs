// files/tet-verify/verify.mjs — checks a devlog entry against its signature sidecar.
//
// One module for both places that check: tools/build.mjs (Node, fails the build) and the "verify"
// link under each post (browser, loaded only when someone clicks it). No npm packages: Ed25519 is
// WebCrypto, ML-DSA-44 is the same tet-pqc-wasm build the TET agent SDK signs with.
//
// The rules mirror verifySigEnvelope in tet-agent-sdk/src/agent.ts (branch agent-identity), plus
// three this file adds because a detached signature is only half the question:
//   - the signing key must be the PINNED agent key, not whatever key the sidecar names;
//   - the chain binding is the PINNED one, never read from the sidecar;
//   - the signed payload must be byte-identical to the entry as published.
//
// What a pass means, and what it does not, is SIG_LIMIT in index.html, shown next to every result.

export const DEVLOG_PAYLOAD_TYPE = 'application/vnd.tet.devlog-entry.v1+json';
const PAE_DOMAIN = 'tet agent payload v1';
const ED_PREFIX = 'tet-ed25519:';
const ML_PREFIX = 'tet-mldsa44:';
const MLDSA44_PUB = 1312, MLDSA44_SIG = 2420, ED_SIG = 64;

const utf8 = s => new TextEncoder().encode(s);

function concat(parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

function b64ToBytes(s) {
  const bin = atob(String(s));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const hex = b => Array.from(b, x => x.toString(16).padStart(2, '0')).join('');

function hexToBytes(h) {
  if (!/^[0-9a-f]{64}$/.test(h)) throw new Error('expected 64 lowercase hex chars');
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}

const sameBytes = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

/** The bytes signed for one entry. An array, so there is no key order to disagree about. */
export function entryPayloadBytes(p) {
  return utf8(JSON.stringify(['tet-devlog-entry-v1', p.date, p.project, p.title, p.body]));
}

/** Sidecar name: sigs/<id>.sig.json. Stable while the date and title are. */
export function entryId(p) {
  const slug = String(p.title).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  return `${p.date}-${slug || 'untitled'}`;
}

/** TET agent PAE. Mirrors agentPayloadAuthMessageBytes in the SDK and agent::agent_payload_auth_message_bytes in tet-core. */
export function agentPayloadAuthMessageBytes(chain, payloadType, payload) {
  const fields = [utf8(chain.chainId), utf8(chain.genesisHash), utf8(payloadType.trim()), payload];
  const parts = [utf8(PAE_DOMAIN), utf8(' ')];
  for (const f of fields) parts.push(utf8(String(f.length)), utf8(' '), f, utf8(' '));
  return concat(parts);
}

export async function mldsa44KeyId(pubB64) {
  return ML_PREFIX + hex(new Uint8Array(await crypto.subtle.digest('SHA-256', b64ToBytes(String(pubB64).trim()))));
}

async function ed25519Verify(pubHex, sigB64, msg) {
  try {
    const key = await crypto.subtle.importKey('raw', hexToBytes(pubHex), { name: 'Ed25519' }, false, ['verify']);
    return await crypto.subtle.verify({ name: 'Ed25519' }, key, b64ToBytes(sigB64), msg);
  } catch { return false; }
}

const fail = reason => ({ ok: false, reason });

/**
 * Check one envelope against one entry.
 *
 * `pin` is { chain_id, genesis_hash, agent_ed25519_pubkey_hex, agent_mldsa44_keyid } — the caller's,
 * never the envelope's. `pqc` is the initialised tet-pqc-wasm module.
 */
export async function verifyEntry(entry, envelope, pin, pqc) {
  const e = envelope || {};
  if (!e.tet || e.tet.v !== 1) return fail('unsupported envelope version');
  if (e.tet.pae !== PAE_DOMAIN) return fail(`unknown pre-image encoding ${JSON.stringify(e.tet.pae)}`);
  for (const k of Object.keys(e)) if (!['payloadType', 'payload', 'signatures', 'tet'].includes(k)) return fail(`unexpected field ${JSON.stringify(k)}`);
  for (const k of Object.keys(e.tet)) if (!['v', 'pae', 'agent_ed25519_pubkey_hex', 'agent_mldsa44_pubkey_b64'].includes(k)) return fail(`unexpected field tet.${k}`);
  if (e.payloadType !== DEVLOG_PAYLOAD_TYPE) return fail(`payloadType is ${JSON.stringify(e.payloadType)}, not a devlog entry`);
  if (!Array.isArray(e.signatures) || e.signatures.length !== 2) return fail(`expected exactly 2 signatures, got ${e.signatures?.length ?? 0}`);

  const pick = prefix => e.signatures.filter(s => typeof s?.keyid === 'string' && s.keyid.startsWith(prefix));
  const eds = pick(ED_PREFIX), mls = pick(ML_PREFIX);
  if (eds.length !== 1) return fail('missing or duplicated ed25519 signature');
  if (mls.length !== 1) return fail('missing or duplicated ml-dsa-44 signature');

  const edHex = String(e.tet.agent_ed25519_pubkey_hex ?? '');
  const mlPub = String(e.tet.agent_mldsa44_pubkey_b64 ?? '');
  if (eds[0].keyid !== ED_PREFIX + edHex) return fail('ed25519 keyid does not match the key it names');
  let mlKeyId;
  try { mlKeyId = await mldsa44KeyId(mlPub); } catch { return fail('ml-dsa-44 key is not base64'); }
  if (mls[0].keyid !== mlKeyId) return fail('ml-dsa-44 keyid does not match the key it names');

  // The pin. Without it any key verifies any text, and the check proves nothing.
  if (edHex !== pin.agent_ed25519_pubkey_hex) return fail('signed by an ed25519 key that is not the pinned agent key');
  if (mlKeyId !== pin.agent_mldsa44_keyid) return fail('signed by an ml-dsa-44 key that is not the pinned agent key');

  let payload, mlSig, edSig;
  try { payload = b64ToBytes(e.payload ?? ''); mlSig = b64ToBytes(mls[0].sig); edSig = b64ToBytes(eds[0].sig); } catch { return fail('envelope is not valid base64'); }
  // Level pinning, before any verification: the wasm verifier would accept a consistent ML-DSA-65 pair.
  if (b64ToBytes(mlPub).length !== MLDSA44_PUB) return fail('ml-dsa key is not ML-DSA-44');
  if (mlSig.length !== MLDSA44_SIG) return fail('ml-dsa signature is not ML-DSA-44');
  if (edSig.length !== ED_SIG) return fail('ed25519 signature has the wrong length');

  // The question a detached signature exists to answer: is the published entry what was signed?
  if (!sameBytes(payload, entryPayloadBytes(entry))) return fail('the entry differs from what was signed');

  const chain = { chainId: pin.chain_id, genesisHash: pin.genesis_hash };
  const msg = agentPayloadAuthMessageBytes(chain, e.payloadType, payload);
  if (!(await ed25519Verify(edHex, eds[0].sig, msg))) return fail('ed25519 signature does not verify');
  let mlOk = false;
  try { mlOk = pqc.mldsa44_verify_b64(mlPub, mls[0].sig, msg) === true; } catch {}
  if (!mlOk) return fail('ml-dsa-44 signature does not verify');
  return { ok: true };
}

let pqcReady = null; // one wasm load per page, however many posts are checked

/** Browser entry point: fetch the pin, the sidecar and the wasm on demand, then check. */
export async function verifyInBrowser(entry) {
  const base = new URL('./', import.meta.url);
  const [pin, envelope, pqc] = await Promise.all([
    fetch(new URL('pin.json', base), { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error('no pinned key published'); return r.json(); }),
    fetch(new URL(`../../sigs/${entryId(entry)}.sig.json`, base), { cache: 'no-cache' }).then(r => (r.ok ? r.json() : null)),
    (pqcReady ||= import('./tet_pqc_wasm.js').then(async m => { await m.default(); return m; })),
  ]);
  if (!envelope) return { ...fail('this entry has no signature'), pin };
  return { ...(await verifyEntry(entry, envelope, pin, pqc)), pin };
}
