// tools/test-sigs.mjs — the devlog signature check, tested. Runs in CI before the build: node tools/test-sigs.mjs
//
// Every refusal case breaks exactly ONE thing, using a signature that is valid for something else, so
// that each case can only fail through the check it is named for. Breaking the payload breaks both
// signature halves at once and proves nothing about either (CLAUDE.md, C4).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { verifyEntry, entryId } from '../files/tet-verify/verify.mjs';
import { loadPqc } from './devlog-sigs.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fx = JSON.parse(fs.readFileSync(path.join(root, 'tools', 'testdata', 'sigs-fixture.json'), 'utf8'));
const pqc = await loadPqc(root);
const { pin, entries: [e0, e1], envelopes: { a0, a1, b0, a0_other_chain } } = fx;
const clone = x => JSON.parse(JSON.stringify(x));
const sigOf = (env, prefix) => env.signatures.find(s => s.keyid.startsWith(prefix));

let failed = 0;
async function expect(name, entry, env, want) {
  const r = await verifyEntry(entry, env, pin, pqc);
  const ok = want === true ? r.ok : !r.ok && r.reason.includes(want);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${r.ok ? '' : ` — ${r.reason}`}`);
  if (!ok) failed++;
}

// The floor.
await expect('a genuine entry verifies', e0, a0, true);
await expect('the second genuine entry verifies', e1, a1, true);

// The published entry changed after signing. The sidecar is untouched, so its signatures are fine.
await expect('one character of the body changed', { ...e0, body: e0.body.replace('Plain', 'plain') }, a0, 'differs from what was signed');
await expect('the title changed', { ...e0, title: 'First test entry.' }, a0, 'differs from what was signed');
await expect('the date changed', { ...e0, date: '2026-10-03' }, a0, 'differs from what was signed');

// Both the entry and the sidecar payload changed, so the comparison passes and only the signatures can refuse.
{
  const t = { ...e0, body: e0.body + ' Added later.' };
  const env = clone(a0);
  env.payload = Buffer.from(JSON.stringify(['tet-devlog-entry-v1', t.date, t.project, t.title, t.body])).toString('base64');
  await expect('entry and signed payload both rewritten', t, env, 'signature does not verify');
}

// One half at a time: a VALID signature by the right key, over the other entry.
{
  const env = clone(a0);
  sigOf(env, 'tet-ed25519:').sig = sigOf(a1, 'tet-ed25519:').sig;
  await expect('ed25519 half is a valid signature over another entry', e0, env, 'ed25519 signature does not verify');
}
{
  const env = clone(a0);
  sigOf(env, 'tet-mldsa44:').sig = sigOf(a1, 'tet-mldsa44:').sig;
  await expect('ml-dsa-44 half is a valid signature over another entry', e0, env, 'ml-dsa-44 signature does not verify');
}

// Correctly signed, by a key that is not the pinned one. Every other check passes.
await expect('valid envelope from an unpinned key', e0, b0, 'not the pinned agent key');
{
  // Only the ML-DSA half is from the other key; the Ed25519 half and keyids say key A.
  const env = clone(a0);
  env.tet.agent_mldsa44_pubkey_b64 = b0.tet.agent_mldsa44_pubkey_b64;
  sigOf(env, 'tet-mldsa44:').keyid = sigOf(b0, 'tet-mldsa44:').keyid;
  sigOf(env, 'tet-mldsa44:').sig = sigOf(b0, 'tet-mldsa44:').sig;
  await expect('ml-dsa-44 half from an unpinned key', e0, env, 'ml-dsa-44 key that is not the pinned agent key');
}

// Same key, same entry, signed for another chain.
await expect('signed for another chain', e0, a0_other_chain, 'signature does not verify');

// Structure.
{
  const env = clone(a0); env.tet.chain_id = pin.chain_id;
  await expect('a chain id smuggled into the envelope is refused, not read', e0, env, 'unexpected field tet.chain_id');
}
{
  const env = clone(a0); sigOf(env, 'tet-mldsa44:').keyid = sigOf(b0, 'tet-mldsa44:').keyid;
  await expect('ml-dsa-44 keyid names another key', e0, env, 'keyid does not match');
}
{
  const env = clone(a0); env.signatures = [env.signatures[0], env.signatures[0]];
  await expect('ed25519 signature given twice, ml-dsa-44 missing', e0, env, 'duplicated');
}
{
  const env = clone(a0); env.payloadType = 'text/plain';
  await expect('another payload type', e0, env, 'not a devlog entry');
}
{
  const env = clone(a0); env.tet.pae = 'DSSEv1';
  await expect('another pre-image encoding', e0, env, 'unknown pre-image encoding');
}

// End to end: the real build script, on a throwaway copy of the site holding the fixture.
function siteCopy(entries) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'devlog-sigs-'));
  for (const f of ['tools/build.mjs', 'tools/devlog-sigs.mjs', 'files/tet-verify/verify.mjs', 'files/tet-verify/tet_pqc_wasm.js', 'files/tet-verify/tet_pqc_wasm_bg.wasm']) {
    fs.mkdirSync(path.dirname(path.join(d, f)), { recursive: true });
    fs.copyFileSync(path.join(root, f), path.join(d, f));
  }
  fs.writeFileSync(path.join(d, 'files/tet-verify/pin.json'), JSON.stringify(pin));
  fs.writeFileSync(path.join(d, 'index.html'), '<!--og--><!--/og-->');
  fs.writeFileSync(path.join(d, 'content.js'), `window.SITE={url:'https://example.test',title:'t',tagline:'t'};window.PROJECTS={tet:{name:'TET'}};window.POSTS=${JSON.stringify(entries)};`);
  fs.mkdirSync(path.join(d, 'sigs'));
  fs.writeFileSync(path.join(d, 'sigs', `${entryId(e0)}.sig.json`), JSON.stringify(a0));
  fs.writeFileSync(path.join(d, 'sigs', `${entryId(e1)}.sig.json`), JSON.stringify(a1));
  return d;
}
function build(d) {
  const env = { PATH: process.env.PATH };
  try { execFileSync(process.execPath, ['tools/build.mjs'], { cwd: d, env, stdio: 'pipe' }); return { code: 0, err: '' }; }
  catch (x) { return { code: x.status, err: String(x.stderr) }; }
}
function expectBuild(name, entries, mutate, wantCode, wantErr = '') {
  const d = siteCopy(entries);
  mutate(d);
  const r = build(d);
  const fed = fs.existsSync(path.join(d, 'feed.xml'));
  const ok = r.code === wantCode && r.err.includes(wantErr) && fed === (wantCode === 0);
  console.log(`${ok ? 'ok  ' : 'FAIL'} build: ${name} (exit ${r.code}${fed ? ', feed written' : ', no feed'})${r.err ? ` — ${r.err.trim().split('\n').pop().trim()}` : ''}`);
  if (!ok) failed++;
  fs.rmSync(d, { recursive: true, force: true });
}
expectBuild('signed entries build', [e0, e1], () => {}, 0);
expectBuild('a tampered body fails the build and writes no feed', [{ ...e0, body: e0.body + ' (edited)' }, e1], () => {}, 1, 'differs from what was signed');
expectBuild('an entry with no signature fails the build', [e0, e1], d => fs.rmSync(path.join(d, 'sigs', `${entryId(e1)}.sig.json`)), 1, 'no signature');
expectBuild('a signature with no entry fails the build', [e0], () => {}, 1, 'does not exist');

console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
