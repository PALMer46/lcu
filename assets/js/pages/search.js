// Site-wide search: characters, organizations, locations, stories, novels, articles, timeline events.
// Thai + English, diacritic-insensitive, pre-built index, grouped results, loading + empty states.
// LUSTZONE content is never indexed here.
import { S, X, $, $$, esc, strip, norm, title, firstImg, pageText, PATHS, HOME, storyHref, loadNovels } from '../core.js';
import { ICON, pageHead, crumbs, item, empty } from '../ui.js';

const TYPES = { char: 'ตัวละคร', org: 'กลุ่ม & องค์กร', place: 'สถานที่ & Lore', story: 'เรื่อง', novel: 'นิยาย', page: 'บทความ', event: 'เหตุการณ์ในไทม์ไลน์' };
let IDX = null, building = null;

export function buildIndex() {
  if (IDX) return Promise.resolve(IDX);
  building ||= loadNovels().then(nv => {
    const D = S.D; const out = [];
    for (const p of Object.keys(D.pages)) {
      if (p === HOME) continue;
      const c = X.charBy.get(p); const txt = pageText(p);
      const type = c ? 'char' : p.startsWith(PATHS.groups + '/') ? 'org' : (p.startsWith(PATHS.worlds) || p === PATHS.tech) ? 'place' : 'page';
      const alias = c ? (txt.match(/(?:นามแฝง|ฉายา)\s+([^ ]+(?: [^ ]+){0,4})/)?.[1] || '') : '';
      out.push({ type, href: p, t: D.pages[p].title, nt: norm(D.pages[p].title), na: norm(alias), nb: norm(txt), raw: txt, th: c?.img || firstImg(p) });
    }
    for (const s of S.TL?.stories || []) if (!s.lust)
      out.push({ type: 'story', href: storyHref(s), t: s.name, nt: norm(s.name), na: norm(s.series.n), nb: '', raw: `${s.series.n}${s.vol ? ' · ' + s.vol : ''} · ${s.count} เหตุการณ์`, ph: String(s.no) });
    for (const e of S.TL?.events || []) { const s = S.TL.stories.find(x => x.no === e.st); if (s?.lust) continue;
      out.push({ type: 'event', href: s ? storyHref(s) : '/universe/timeline', t: (s ? s.name : 'ไทม์ไลน์'), nt: '', na: '', nb: norm(e.t), raw: e.t, ph: e.y ? String(e.y + 543).slice(2) : '•' }); }
    for (const n of nv.novels || []) if (!n.adult && n.status !== 'draft')
      out.push({ type: 'novel', href: '/novels/' + n.slug, t: n.title, nt: norm(n.title), na: norm(n.author || ''), nb: norm(n.description || ''), raw: n.description || '', ph: 'N' });
    IDX = out; return out;
  });
  return building;
}

export function query(q, limit = 0) {
  const toks = q.split(/\s+/).map(norm).filter(Boolean); if (!toks.length || !IDX) return [];
  const res = [];
  for (const e of IDX) {
    let score = 0;
    for (const t of toks) {
      if (e.nt === t) score += 100; else if (e.nt.startsWith(t)) score += 60; else if (e.nt.includes(t)) score += 40;
      else if (e.na.includes(t)) score += 30; else if (e.nb.includes(t)) score += e.type === 'event' ? 4 : 10; else { score = 0; break; }
    }
    if (score) res.push({ e, score: score + (e.type === 'char' ? 3 : e.type === 'org' ? 2 : 0) });
  }
  res.sort((a, b) => b.score - a.score);
  return limit ? res.slice(0, limit) : res;
}
function snippet(raw, q) {
  const low = raw.toLowerCase(); const ql = q.trim().toLowerCase(); let at = ql ? low.indexOf(ql) : -1;
  const s = at >= 0 ? raw.slice(Math.max(0, at - 50), at + 110) : raw.slice(0, 150);
  let h = esc(s); if (at >= 0) { const r = new RegExp(esc(q.trim()).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'); h = h.replace(r, m => `<mark>${m}</mark>`); }
  return (at > 50 ? '… ' : '') + h + (raw.length > s.length ? ' …' : '');
}
export const resultHTML = (r, q) => item({ href: r.e.href, t: esc(r.e.t), d: snippet(r.e.raw, q), th: r.e.th, ph: r.e.ph || TYPES[r.e.type][0] });

/* full results page */
export async function renderSearch(q, type) {
  const app = $('#app');
  app.innerHTML = pageHead({ crumbsHTML: crumbs([['หน้าแรก', '/'], ['ค้นหา', null]]), eyebrow: 'Search', h1: q ? `ผลการค้นหา “${q}”` : 'ค้นหาในจักรวาล LCU' }) + `
  <div class="wrap"><section class="section">
    <form class="toolbar" id="sf" role="search"><label class="field">${ICON.search}<span class="sr-only">คำค้นหา</span><input name="q" type="search" value="${esc(q)}" placeholder="ชื่อตัวละคร องค์กร สถานที่ เรื่อง… (ไทย / English)" autocomplete="off"></label><button class="btn">ค้นหา</button></form>
    <div id="sr" aria-live="polite"><div class="stack">${'<div class="skel" style="height:70px"></div>'.repeat(4)}</div></div></section></div>`;
  $('#sf').onsubmit = e => { e.preventDefault(); location.hash = '#/ค้นหา?q=' + encodeURIComponent(e.target.q.value.trim()); };
  await buildIndex();
  const el = $('#sr'); if (!el) return;
  if (!q.trim()) { el.innerHTML = empty('พิมพ์คำที่ต้องการค้นหา', '<p>ค้นหาได้ทั้งภาษาไทยและภาษาอังกฤษ เช่น “อากรัท”, “CODE2”, “Illuminati”</p>', '⌕'); return; }
  const all = query(q); const counts = {}; all.forEach(r => counts[r.e.type] = (counts[r.e.type] || 0) + 1);
  const list = type ? all.filter(r => r.e.type === type) : all;
  if (!all.length) { el.innerHTML = empty(`ไม่พบผลลัพธ์สำหรับ “${esc(q)}”`, '<p>ลองตรวจตัวสะกด ใช้คำที่สั้นลง หรือค้นด้วยชื่อภาษาอังกฤษ</p><div class="chips" style="justify-content:center;margin-top:14px"><a class="chip" href="#/ตวละคร">ดูตัวละครทั้งหมด</a><a class="chip" href="#/universe/timeline">เปิดไทม์ไลน์</a></div>', '∅'); return; }
  const tabs = `<div class="chips" style="margin-bottom:18px" role="tablist"><a class="chip" role="tab" aria-pressed="${!type}" href="#/ค้นหา?q=${encodeURIComponent(q)}">ทั้งหมด <span class="n">${all.length}</span></a>${Object.keys(TYPES).filter(k => counts[k]).map(k => `<a class="chip" role="tab" aria-pressed="${type === k}" href="#/ค้นหา?q=${encodeURIComponent(q)}&type=${k}">${TYPES[k]} <span class="n">${counts[k]}</span></a>`).join('')}</div>`;
  const groups = type ? [[type, list]] : Object.keys(TYPES).map(k => [k, list.filter(r => r.e.type === k)]).filter(g => g[1].length);
  el.innerHTML = tabs + groups.map(([k, rs]) => `<div class="eyebrow" style="margin:22px 0 8px">${TYPES[k]} · ${rs.length}</div><div class="stack" style="--g:4px">${rs.slice(0, type ? 300 : 8).map(r => resultHTML(r, q)).join('')}${!type && rs.length > 8 ? `<a class="more" style="display:block;padding:8px 12px;font:500 14px var(--f-head)" href="#/ค้นหา?q=${encodeURIComponent(q)}&type=${k}">ดูทั้งหมด ${rs.length} รายการ →</a>` : ''}</div>`).join('');
}
export { TYPES };
