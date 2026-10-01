// tools/devlog-sigs.mjs — check every devlog entry against its sidecar in sigs/.
// Used by tools/build.mjs (which fails on any problem) and tools/test-sigs.mjs (which proves it does).
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { verifyEntry, entryId } from '../files/tet-verify/verify.mjs';

export function loadPosts(root) {
  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'content.js'), 'utf8'), ctx);
  return ctx.window.POSTS || [];
}

export async function loadPqc(root) {
  const dir = path.join(root, 'files', 'tet-verify');
  const pqc = await import(path.join(dir, 'tet_pqc_wasm.js'));
  pqc.initSync({ module: fs.readFileSync(path.join(dir, 'tet_pqc_wasm_bg.wasm')) });
  return pqc;
}

export function readPin(root) {
  const p = path.join(root, 'files', 'tet-verify', 'pin.json');
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
}

/**
 * Returns { checked, problems[] }. A problem is any entry without a signature, any signature that does
 * not verify against the entry as published, any sidecar naming no entry, and two entries sharing an id.
 * With no pin.json, signing is not set up and nothing is checked; the caller says so out loud.
 */
export async function checkAll(root, posts = loadPosts(root)) {
  const pin = readPin(root);
  if (!pin) return { checked: 0, problems: [], pinned: false };
  const pqc = await loadPqc(root);
  const dir = path.join(root, 'sigs');
  const problems = [];
  const seen = new Set();
  for (const p of posts) {
    const id = entryId(p);
    if (seen.has(id)) { problems.push(`${id}: two entries share this id; change one title`); continue; }
    seen.add(id);
    const f = path.join(dir, `${id}.sig.json`);
    if (!fs.existsSync(f)) { problems.push(`${id}: no signature`); continue; }
    let env;
    try { env = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { problems.push(`${id}: sidecar is not JSON`); continue; }
    const r = await verifyEntry(p, env, pin, pqc);
    if (!r.ok) problems.push(`${id}: ${r.reason}`);
  }
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.sig.json')) continue;
      const id = f.slice(0, -'.sig.json'.length);
      if (!seen.has(id)) problems.push(`${id}: signature for an entry that does not exist (renamed or deleted?)`);
    }
  }
  return { checked: posts.length, problems, pinned: true };
}
