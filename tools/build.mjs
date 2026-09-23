// tools/build.mjs — run by the GitHub Action (or by hand: node tools/build.mjs).
// Writes feed.xml (RSS) and stats.json, and keeps the share-card tags in index.html
// pointing at SITE.url. Reads everything from content.js. No npm packages needed.
import fs from 'node:fs';
import net from 'node:net';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'content.js'), 'utf8'), ctx);
const { SITE, PROJECTS, POSTS = [] } = ctx.window;
const base = (SITE.url || '').replace(/\/$/, '');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));

// ---------- feed.xml ----------
const plain = md => md.replace(/```[\s\S]*?```/g, '').replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/`([^`]+)`/g, '$1').replace(/\*\*/g, '').trim();
const html = md => plain(md).split(/\n\s*\n/).map(p => '<p>' + esc(p).replace(/\n/g, '<br>') + '</p>').join('');
const items = POSTS.map((p, i) => ({ ...p, n: i })).reverse().slice(0, 50).map(p => {
  const link = `${base}/#/p/${p.project}/log`;
  const date = new Date(p.date + 'T12:00:00Z').toUTCString();
  return `  <item>
    <title>${esc((PROJECTS[p.project]?.name || p.project) + ': ' + p.title)}</title>
    <link>${esc(link)}</link>
    <guid isPermaLink="false">${esc(p.project + '-' + p.date + '-' + p.n)}</guid>
    <pubDate>${date}</pubDate>
    <description>${esc(html(p.body))}</description>
  </item>`;
}).join('\n');
fs.writeFileSync(path.join(root, 'feed.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>${esc(SITE.title)}</title>
  <link>${esc(base + '/')}</link>
  <description>${esc(SITE.tagline)}</description>
  <language>en</language>
${items}
</channel>
</rss>
`);

// ---------- share card tags in index.html ----------
const idxPath = path.join(root, 'index.html');
const idx = fs.readFileSync(idxPath, 'utf8');
const og = `<!--og-->
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(SITE.title)}">
<meta property="og:description" content="${esc(SITE.tagline)}">
<meta property="og:image" content="${esc(base)}/og.jpg">
<meta property="og:url" content="${esc(base)}/">
<meta name="twitter:card" content="summary_large_image">
<!--/og-->`;
const next = idx.replace(/<!--og-->[\s\S]*?<!--\/og-->/, og);
if (next !== idx) fs.writeFileSync(idxPath, next);

// ---------- stats.json ----------
// Every source is optional. Set them as repository variables (Settings → Secrets and variables → Actions → Variables):
//   TET_SEED        host:port to TCP-check, e.g. 95.217.158.153:8002
//   TET_STATE_URL   a public URL that returns the node's /ledger/state JSON (only if you expose one)
//   UNFOG_STATS_URL a URL that returns {"users": 123}
//   KPEE_REPO       owner/repo whose release downloads to count, e.g. Ai0090/kpee
const tcp = (hostport, ms = 5000) => new Promise(res => {
  const [host, port] = hostport.split(':'); const s = net.connect({ host, port: +port });
  const done = ok => { s.destroy(); res(ok); };
  s.setTimeout(ms, () => done(false)); s.on('connect', () => done(true)); s.on('error', () => done(false));
});
const getJson = async url => { const r = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'site-build' } }); if (!r.ok) throw new Error(r.status); return r.json(); };
const env = process.env;
const stats = { checked_at: new Date().toISOString() };
if (env.TET_SEED) stats.tet = { seed_online: await tcp(env.TET_SEED) };
if (env.TET_STATE_URL) {
  try { const s = await getJson(env.TET_STATE_URL); const h = s.height ?? s.block_height ?? s.latest_height; if (h != null) (stats.tet ||= {}).height = h; } catch {}
}
if (env.UNFOG_STATS_URL) { try { const u = await getJson(env.UNFOG_STATS_URL); if (u.users != null) stats.unfog = { users: u.users }; } catch {} }
if (env.KPEE_REPO) {
  try {
    const rel = await getJson(`https://api.github.com/repos/${env.KPEE_REPO}/releases?per_page=100`);
    stats.kpee = { downloads: rel.reduce((n, r) => n + (r.assets || []).reduce((m, a) => m + a.download_count, 0), 0) };
  } catch {}
}
fs.writeFileSync(path.join(root, 'stats.json'), JSON.stringify(stats, null, 2) + '\n');
console.log(`feed.xml: ${Math.min(POSTS.length, 50)} posts · stats: ${JSON.stringify(stats)}`);
