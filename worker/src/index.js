// LCU API — Cloudflare Worker + D1
// Endpoints
//   POST /v1/events            reading events (validated, deduplicated, rate-limited, bot-filtered)
//   GET  /v1/stats?scope=...   global | vol-N | lustzone | novel:<id>   (lustzone requires age token)
//   POST /v1/age               issue a signed, expiring LUSTZONE age token (self-declaration)
//   GET  /v1/lz/chapter?novel=<id>&n=<num>   protected adult chapter (requires age token)
//   GET/PUT /v1/progress       optional server-side reading progress for a pseudonymous reader id
// No privileged key ever reaches the browser: D1 is reached only through the binding below.

const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...headers } });
const BOT = /bot|crawl|spider|slurp|preview|headless|lighthouse|python|curl|wget|httpclient|monitor/i;
const ID = /^[A-Za-z0-9_\-:.]{1,80}$/;

function cors(req, env) {
  const origin = req.headers.get('origin') || '';
  const ok = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).includes(origin);
  return ok ? { 'access-control-allow-origin': origin, 'access-control-allow-methods': 'GET,POST,PUT,OPTIONS', 'access-control-allow-headers': 'content-type,authorization', 'access-control-max-age': '86400', vary: 'origin' } : {};
}
async function sha256(s) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }
async function hmac(secret, msg) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const s = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg));
  return btoa(String.fromCharCode(...new Uint8Array(s))).replace(/[+/=]/g, c => ({ '+': '-', '/': '_', '=': '' }[c]));
}
async function verifyAge(req, env) {
  const t = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const [exp, sig] = t.split('.'); if (!exp || !sig || !env.AGE_SECRET) return false;
  if (Number(exp) < Date.now()) return false;
  return (await hmac(env.AGE_SECRET, 'age18:' + exp)) === sig;
}
async function rateLimited(req, env) {
  const ip = req.headers.get('cf-connecting-ip') || '0';
  const ipHash = (await sha256((env.IP_SALT || '') + ip)).slice(0, 24);   // IP is never stored in clear
  const min = Math.floor(Date.now() / 60000); const k = ipHash + ':' + min;
  const row = await env.DB.prepare('INSERT INTO rate_limits (k,n,expire) VALUES (?1,1,?2) ON CONFLICT(k) DO UPDATE SET n=n+1 RETURNING n').bind(k, (min + 2) * 60000).first();
  if (Math.random() < 0.02) await env.DB.prepare('DELETE FROM rate_limits WHERE expire < ?1').bind(Date.now()).run();
  return row.n > Number(env.RATE_LIMIT_PER_MIN || 60);
}

async function postEvent(req, env) {
  if (BOT.test(req.headers.get('user-agent') || '')) return json({ ok: true, counted: false, reason: 'bot' }, 202);
  if (await rateLimited(req, env)) return json({ ok: false, error: 'rate_limited' }, 429);
  let b; try { b = await req.json(); } catch { return json({ ok: false, error: 'bad_json' }, 400); }
  const { type, novel, chapter = null, reader, session = null } = b || {};
  if (!['novel_view', 'chapter_view'].includes(type) || !ID.test(novel || '') || !ID.test(reader || '') || (chapter && !ID.test(chapter)) || (session && !ID.test(session)))
    return json({ ok: false, error: 'invalid' }, 400);
  // novel (and chapter) must exist and be published
  const nv = await env.DB.prepare(`SELECT n.id, c.is_adult FROM novels n JOIN categories c ON c.id=n.category_id WHERE n.id=?1 AND n.status!='draft'`).bind(novel).first();
  if (!nv) return json({ ok: false, error: 'unknown_novel' }, 404);
  if (nv.is_adult && !(await verifyAge(req, env))) return json({ ok: false, error: 'age_required' }, 403);
  if (type === 'chapter_view') {
    const ch = await env.DB.prepare('SELECT id FROM chapters WHERE id=?1 AND novel_id=?2 AND is_published=1').bind(chapter, novel).first();
    if (!ch) return json({ ok: false, error: 'unknown_chapter' }, 404);
  }
  const now = Date.now(); const win = now - Number(env.DEDUPE_MINUTES || 30) * 60000;
  // duplicate protection: same reader + same chapter (or novel page) inside the window is not counted again
  const dup = await env.DB.prepare(`SELECT 1 FROM reading_events WHERE reader_id=?1 AND event_type=?2 AND IFNULL(chapter_id,'')=IFNULL(?3,'') AND novel_id=?4 AND created_at>?5 LIMIT 1`)
    .bind(reader, type, chapter, novel, win).first();
  if (dup) return json({ ok: true, counted: false, reason: 'duplicate' }, 202);
  await env.DB.prepare('INSERT INTO reading_events (novel_id,chapter_id,reader_id,session_id,event_type,created_at) VALUES (?1,?2,?3,?4,?5,?6)')
    .bind(novel, chapter, reader, session, type, now).run();
  return json({ ok: true, counted: true }, 201);
}

async function getStats(req, env, url) {
  const scope = url.searchParams.get('scope') || 'global';
  let where = 'c.is_adult=0', bind = [];
  if (scope === 'global') where = 'c.is_adult=0';
  else if (/^vol-\d+$/.test(scope)) { where = 'c.is_adult=0 AND n.volume_id=?1'; bind = [scope]; }
  else if (scope === 'lustzone') { if (!(await verifyAge(req, env))) return json({ error: 'age_required' }, 403); where = 'c.is_adult=1'; }
  else if (scope.startsWith('novel:') && ID.test(scope.slice(6))) {
    const nv = await env.DB.prepare('SELECT c.is_adult FROM novels n JOIN categories c ON c.id=n.category_id WHERE n.id=?1').bind(scope.slice(6)).first();
    if (!nv) return json({ error: 'unknown_novel' }, 404);
    if (nv.is_adult && !(await verifyAge(req, env))) return json({ error: 'age_required' }, 403);
    where = 'n.id=?1'; bind = [scope.slice(6)];
  } else return json({ error: 'bad_scope' }, 400);
  const pub = `n.status!='draft'`;
  const q = sql => env.DB.prepare(sql).bind(...bind).first();
  const [ev, nv, ch] = await Promise.all([
    q(`SELECT SUM(e.event_type='chapter_view') views, COUNT(DISTINCT e.reader_id) readers, MAX(e.created_at) last_read FROM reading_events e JOIN novels n ON n.id=e.novel_id JOIN categories c ON c.id=n.category_id WHERE ${where} AND ${pub}`),
    q(`SELECT COUNT(*) k FROM novels n JOIN categories c ON c.id=n.category_id WHERE ${where} AND ${pub}`),
    q(`SELECT COUNT(*) k FROM chapters h JOIN novels n ON n.id=h.novel_id JOIN categories c ON c.id=n.category_id WHERE ${where} AND ${pub} AND h.is_published=1`),
  ]);
  const out = { scope, views: ev?.views || 0, readers: ev?.readers || 0, novels: nv?.k || 0, chapters: ch?.k || 0, last_read: ev?.last_read || null, unique_readers_note: 'estimate based on pseudonymous browser ids' };
  if (scope === 'lustzone' || scope === 'global') {
    const top = await env.DB.prepare(`SELECT n.id, n.title, COUNT(*) v FROM reading_events e JOIN novels n ON n.id=e.novel_id JOIN categories c ON c.id=n.category_id WHERE ${where} AND ${pub} AND e.event_type='chapter_view' GROUP BY n.id ORDER BY v DESC LIMIT 1`).bind(...bind).first();
    out.most_read = top || null;
  }
  return json(out, 200, { 'cache-control': 'public, max-age=60' });
}

async function issueAge(req, env) {
  let b; try { b = await req.json(); } catch { b = {}; }
  if (b.confirm !== true) return json({ error: 'confirmation_required' }, 400);
  if (!env.AGE_SECRET) return json({ error: 'not_configured' }, 503);
  const exp = Date.now() + Number(env.AGE_TOKEN_DAYS || 30) * 864e5;
  return json({ token: `${exp}.${await hmac(env.AGE_SECRET, 'age18:' + exp)}`, exp, note: 'self-declaration, not verified age assurance' });
}

async function lzChapter(req, env, url) {
  if (!(await verifyAge(req, env))) return json({ error: 'age_required' }, 403);
  const novel = url.searchParams.get('novel') || ''; const n = Number(url.searchParams.get('n'));
  if (!ID.test(novel) || !Number.isInteger(n)) return json({ error: 'invalid' }, 400);
  const row = await env.DB.prepare(`SELECT h.chapter_number n, h.title, h.content FROM chapters h JOIN novels v ON v.id=h.novel_id JOIN categories c ON c.id=v.category_id
    WHERE h.novel_id=?1 AND h.chapter_number=?2 AND h.is_published=1 AND v.status!='draft' AND c.is_adult=1`).bind(novel, n).first();
  if (!row) return json({ error: 'not_found' }, 404);
  return json({ n: row.n, title: row.title, blocks: JSON.parse(row.content || '[]') }, 200, { 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex' });
}

// ---- LUSTZONE catalog (age token required for everything below) ----
async function lzNovels(req, env) {
  if (!(await verifyAge(req, env))) return json({ error: 'age_required' }, 403);
  const { results } = await env.DB.prepare(`SELECT n.id, n.title, n.slug, n.description, n.status, n.updated_at,
      (SELECT COUNT(*) FROM chapters h WHERE h.novel_id=n.id AND h.is_published=1) chapters,
      (SELECT 'data:' || mime || ';base64,' || data FROM lz_covers WHERE novel_id=n.id) cover
    FROM novels n JOIN categories c ON c.id=n.category_id WHERE c.is_adult=1 AND n.status!='draft' ORDER BY n.slug`).all();
  return json({ novels: results }, 200, { 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex' });
}
async function lzNovel(req, env, url) {
  if (!(await verifyAge(req, env))) return json({ error: 'age_required' }, 403);
  const id = url.searchParams.get('id') || ''; if (!ID.test(id)) return json({ error: 'invalid' }, 400);
  const n = await env.DB.prepare(`SELECT n.id, n.title, n.slug, n.description, n.status, n.updated_at FROM novels n JOIN categories c ON c.id=n.category_id
    WHERE n.id=?1 AND c.is_adult=1 AND n.status!='draft'`).bind(id).first();
  if (!n) return json({ error: 'not_found' }, 404);
  const { results } = await env.DB.prepare(`SELECT chapter_number n, title, length(content) len FROM chapters WHERE novel_id=?1 AND is_published=1 ORDER BY chapter_number`).bind(id).all();
  n.chapters = results.map(r => ({ n: r.n, title: r.title, minutes: Math.max(1, Math.round((r.len || 0) / 900)) }));
  return json(n, 200, { 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex' });
}

async function progress(req, env, url) {
  const reader = url.searchParams.get('reader') || '';
  if (!ID.test(reader)) return json({ error: 'invalid' }, 400);
  if (req.method === 'GET') {
    const { results } = await env.DB.prepare('SELECT novel_id, chapter_id, progress_position, updated_at FROM reading_progress WHERE reader_id=?1').bind(reader).all();
    return json({ progress: results });
  }
  if (await rateLimited(req, env)) return json({ error: 'rate_limited' }, 429);
  const b = await req.json().catch(() => ({}));
  if (!ID.test(b.novel || '') || (b.chapter && !ID.test(b.chapter)) || !(b.pos >= 0 && b.pos <= 1)) return json({ error: 'invalid' }, 400);
  await env.DB.prepare(`INSERT INTO reading_progress (reader_id,novel_id,chapter_id,progress_position,updated_at) VALUES (?1,?2,?3,?4,?5)
    ON CONFLICT(reader_id,novel_id) DO UPDATE SET chapter_id=excluded.chapter_id, progress_position=excluded.progress_position, updated_at=excluded.updated_at`).bind(reader, b.novel, b.chapter || null, b.pos, Date.now()).run();
  return json({ ok: true });
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url); const h = cors(req, env);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    let res;
    try {
      if (url.pathname === '/v1/events' && req.method === 'POST') res = await postEvent(req, env);
      else if (url.pathname === '/v1/stats' && req.method === 'GET') res = await getStats(req, env, url);
      else if (url.pathname === '/v1/age' && req.method === 'POST') res = await issueAge(req, env);
      else if (url.pathname === '/v1/lz/chapter' && req.method === 'GET') res = await lzChapter(req, env, url);
      else if (url.pathname === '/v1/lz/novels' && req.method === 'GET') res = await lzNovels(req, env);
      else if (url.pathname === '/v1/lz/novel' && req.method === 'GET') res = await lzNovel(req, env, url);
      else if (url.pathname === '/v1/progress' && (req.method === 'GET' || req.method === 'PUT')) res = await progress(req, env, url);
      else res = json({ error: 'not_found' }, 404);
    } catch (e) { console.error(e); res = json({ error: 'server_error' }, 500); }
    for (const [k, v] of Object.entries(h)) res.headers.set(k, v);
    return res;
  },
};
