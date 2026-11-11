// Novel library + online reader (online-only: no download feature by design).
import { S, $, $$, esc, img, store, fmt, go, loadNovels, volumes, storyHref, storyYears, storyBy, markLabel } from '../core.js';
import { ICON, pageHead, crumbs, secHead, empty } from '../ui.js';
import { track, statBlock } from '../stats.js';

const app = () => $('#app');
const STATUS = { ongoing: ['กำลังเผยแพร่', 'ongoing'], completed: ['จบแล้ว', 'completed'], coming_soon: ['เร็ว ๆ นี้', 'soon'] };
const statusBadge = s => STATUS[s] ? `<span class="status ${STATUS[s][1]}">${STATUS[s][0]}</span>` : '';
const progress = () => store.get('lcu:progress', {});
const chLabel = (c, n) => c && c.title ? (/^(ตอน|บท)/.test(c.title) ? c.title : `ตอนที่ ${c.n ?? n} · ${c.title}`) : `ตอนที่ ${n}`;
const cover = n => n.cover ? `<img src="${esc(n.cover)}" alt="${esc(n.title)}" loading="lazy" decoding="async">` : `<div style="display:grid;place-items:center;height:100%;font:600 28px var(--f-display);color:var(--gold)">LCU</div>`;
const pub = nv => (nv.novels || []).filter(n => n.status !== 'draft' && !n.adult).sort((a, b) => (parseFloat(a.story_no) || 999) - (parseFloat(b.story_no) || 999));

function novelCard(n) {
  const p = progress()[n.slug];
  return `<a class="card nv-card" href="#/novels/${esc(n.slug)}"><div class="art">${cover(n)}</div><div class="tagline">${statusBadge(n.status)}</div>
    <div class="cap"><div class="nm">${esc(n.title)}</div><div class="sb">${n.story_no ? `#${esc(n.story_no)} · ` : ''}${n.chapters > 1 ? n.chapters + ' ตอน' : 'ตอนเดียวจบ'}${p ? ` · อ่านค้าง ${Math.round((p.pos || 0) * 100)}%` : ''}</div></div></a>`;
}
async function getJSON(u) { const r = await fetch(u); if (!r.ok) throw new Error(r.status); return r.json(); }

/* ================================================================ LIBRARY */
export async function renderLibrary() {
  app().innerHTML = pageHead({ crumbsHTML: crumbs([['หน้าแรก', '/'], ['นิยาย', null]]), eyebrow: 'Online Library', h1: 'คลังนิยาย LCU', sub: 'อ่านออนไลน์ได้ทันที ไม่ต้องสมัครสมาชิก ระบบจำตอนที่อ่านค้างไว้ให้อัตโนมัติ' }) + `<div class="wrap" id="lib"><div class="section"><div class="skel" style="height:260px"></div></div></div>`;
  const nv = await loadNovels(); const list = pub(nv); const vols = volumes(); const prog = progress();
  const cont = Object.entries(prog).map(([slug, p]) => ({ n: list.find(x => x.slug === slug), p })).filter(x => x.n).sort((a, b) => b.p.t - a.p.t);
  $('#lib').innerHTML = `
    ${cont.length ? `<section class="section">${secHead('อ่านต่อ')}<div class="stack">${cont.slice(0, 3).map(({ n, p }) => `<a class="item" href="#/novels/${esc(n.slug)}/${p.n}"><div class="th">${n.cover ? `<img src="${esc(n.cover)}" alt="">` : ''}</div><div><div class="t">${esc(n.title)}</div><div class="d">${n.chapters > 1 ? esc(p.title || 'ตอนที่ ' + p.n) + ' · ' : ''}อ่านแล้ว ${Math.round((p.pos || 0) * 100)}%</div></div></a>`).join('')}</div></section>` : ''}
    ${vols.map(v => { const ns = list.filter(n => n.volume === 'vol-' + v.n); return `<section class="section">${secHead(esc(v.full), 'รายละเอียด Volume', '/novels/vol-' + v.n)}
      ${ns.length ? `<div class="grid">${ns.map(novelCard).join('')}</div>` : `<div class="notice">ยังไม่มีนิยายใน Volume นี้ที่อ่านบนเว็บไซต์ได้${v.links.length ? ` — อ่านได้แล้วบน ${v.links.map(l => `<a href="${esc(l.href)}" target="_blank" rel="noopener">${esc(l.name)}</a>`).join(', ')}` : ''}</div>`}</section>`; }).join('')}
    ${list.some(n => !/^vol-\d+$/.test(n.volume || '')) ? `<section class="section">${secHead('เรื่องอื่น ๆ')}<div class="grid">${list.filter(n => !/^vol-\d+$/.test(n.volume || '')).map(novelCard).join('')}</div></section>` : ''}
    <section class="section">${secHead('สถิติคลังนิยาย', 'ดูสถิติทั้งหมด', '/stats')}${statBlock('global')}</section>`;
}

/* ================================================================ VOLUME */
export async function renderVolume(n) {
  const v = volumes().find(x => x.n === n);
  if (!v) { app().innerHTML = pageHead({ h1: 'ไม่พบ Volume นี้' }) + `<div class="wrap"><section class="section">${empty('ไม่พบ Volume นี้')}</section></div>`; return; }
  const nv = await loadNovels(); const ns = pub(nv).filter(x => x.volume === 'vol-' + n);
  app().innerHTML = pageHead({ crumbsHTML: crumbs([['หน้าแรก', '/'], ['นิยาย', '/novels'], [`Vol.${n}`, null]]), eyebrow: `Volume ${n}`, h1: v.full, bg: v.art[0] || null }) + `<div class="wrap">
    ${v.art.length ? `<section class="section"><div class="gal">${v.art.map(a => img(a, { cls: 'z', alt: v.full })).join('')}</div></section>` : ''}
    <section class="section">${secHead('อ่านบนเว็บไซต์ LCU')}${ns.length ? `<div class="grid">${ns.map(novelCard).join('')}</div>` : empty('ยังไม่มีนิยายใน Volume นี้บนเว็บไซต์', '<p>จะแสดงอัตโนมัติเมื่อมีการนำเข้านิยาย</p>', '◇')}</section>
    ${v.links.length ? `<section class="section">${secHead('ช่องทางอ่านบนแพลตฟอร์ม')}<div class="grid sm">${v.links.map(l => `<a class="card text" href="${esc(l.href)}" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:12px;padding:14px">${img(l.logo, { alt: l.name }).replace('<img', '<img style="width:44px;height:44px;border-radius:10px;object-fit:cover"')}<b style="font:500 15px var(--f-head);color:#fff">${esc(l.name)}</b>${ICON.ext}</a>`).join('')}</div></section>` : ''}
    ${v.stories.length || v.planned.length ? `<section class="section">${secHead('เรื่องใน Volume นี้', 'ฐานข้อมูลเรื่อง', '/universe/stories')}<div class="stack">
      ${v.stories.map(s => `<a class="item" href="#${ns.find(x => String(x.story_no) === String(s.no)) ? '/novels/' + ns.find(x => String(x.story_no) === String(s.no)).slug : storyHref(s)}"><div class="th ph" style="color:${s.series.c}">${s.no}</div><div><div class="t">${esc(s.name)}</div><div class="d">${esc(s.series.n)}${storyYears(s) ? ' · พ.ศ. ' + storyYears(s) : ''}</div></div></a>`).join('')}
      ${v.planned.map(p => `<div class="item"><div class="th ph">${p.no || '–'}</div><div><div class="t">${esc(p.name)}</div><div class="d">${p.mark} ${markLabel(p.mark)}</div></div></div>`).join('')}</div></section>` : ''}
    <section class="section">${secHead('สถิติ Vol.' + n)}${statBlock('vol-' + n)}</section></div>`;
}

/* ================================================================ NOVEL DETAIL */
export async function renderNovel(slug) {
  app().innerHTML = `<div class="wrap"><div class="skel" style="height:320px;margin-top:40px"></div></div>`;
  const nv = await loadNovels(); const n = pub(nv).find(x => x.slug === slug);
  if (!n) { app().innerHTML = pageHead({ crumbsHTML: crumbs([['หน้าแรก', '/'], ['นิยาย', '/novels'], ['ไม่พบ', null]]), h1: 'ไม่พบนิยายเรื่องนี้' }) + `<div class="wrap"><section class="section">${empty('ไม่พบนิยายเรื่องนี้', '<a class="btn ghost sm" href="#/novels" style="margin-top:14px">กลับคลังนิยาย</a>')}</section></div>`; return; }
  let meta; try { meta = await getJSON(`novels/${encodeURIComponent(slug)}/meta.json`); } catch { meta = { chapters: [] }; }
  const p = progress()[slug]; const chs = (meta.chapters || []).filter(c => c.published !== false);
  track({ type: 'novel_view', novel: n.id });
  app().innerHTML = pageHead({ crumbsHTML: crumbs([['หน้าแรก', '/'], ['นิยาย', '/novels'], [n.title, null]]), eyebrow: esc(n.volume_name || n.category || 'LCU'), h1: n.title,
    sub: esc(n.description || ''), extra: `<div class="chips" style="margin-top:14px">${statusBadge(n.status)}${n.author ? `<span class="chip">โดย ${esc(n.author)}</span>` : ''}<span class="chip">${chs.length > 1 ? chs.length + ' ตอน' : 'ตอนเดียวจบ'}</span>${n.story_no && storyBy(n.story_no) ? `<a class="chip" href="#${storyHref(storyBy(n.story_no))}">เรื่องที่ ${esc(n.story_no)} ในไทม์ไลน์ →</a>` : ''}${n.updated_at ? `<span class="chip">ลงเว็บ ${esc(n.updated_at.slice(0, 10))}</span>` : ''}</div>
      <div class="cta" style="display:flex;gap:10px;margin-top:20px;flex-wrap:wrap">${chs.length ? `<a class="btn" href="#/novels/${esc(slug)}/${p ? p.n : chs[0].n}">${p ? 'อ่านต่อ ตอนที่ ' + p.n : 'เริ่มอ่าน'}</a>` : ''}</div>` }) + `
  <div class="wrap"><div class="cols section">
    <section>${secHead('สารบัญ')}${chs.length ? `<div class="toc-list">${chs.map(c => `<a href="#/novels/${esc(slug)}/${c.n}" class="${p && c.n < p.n ? 'read' : ''} ${p && c.n === p.n ? 'cur' : ''}"><span>${esc(chLabel(c, c.n))}</span><span class="muted" style="font-size:13px">${c.minutes ? '~' + c.minutes + ' นาที' : ''}</span></a>`).join('')}</div>` : empty('ยังไม่มีตอนที่เผยแพร่')}</section>
    <aside class="panel"><div style="aspect-ratio:2/3;border-radius:10px;overflow:hidden;background:var(--surface-3)">${cover(n)}</div>${statBlock('novel:' + n.id, ['views', 'readers'])}</aside>
  </div></div>`;
}

/* ================================================================ READER */
const PREF_DEF = { size: 19, lh: 1.95, theme: 'dark', font: 'sans' };
// src (optional) lets other sections reuse the reader, e.g. LUSTZONE chapters served by the protected API:
// { base: '/lustzone/<id>', key: 'lz:<id>', load: async num => ({ n:{id,title}, meta:{chapters}, ch }) }
export async function renderReader(slug, num, src = null) {
  const base = src ? src.base : '/novels/' + slug; const pkey = src ? src.key : slug;
  document.body.classList.add('reading');
  app().innerHTML = `<div class="reader"><div class="rbar"><a class="icon-btn" href="#${esc(base)}" aria-label="กลับไปหน้านิยาย">${ICON.back}</a><div class="t">กำลังโหลด…</div></div><article><div class="skel" style="height:40px;width:60%"></div><div class="skel" style="height:400px;margin-top:30px"></div></article></div>`;
  let n, meta, ch;
  if (src) { try { ({ n, meta, ch } = await src.load(num)); } catch { ch = null; } }
  else {
    const nv = await loadNovels(); n = pub(nv).find(x => x.slug === slug);
    try { meta = await getJSON(`novels/${encodeURIComponent(slug)}/meta.json`); ch = await getJSON(`novels/${encodeURIComponent(slug)}/${num}.json`); } catch { ch = null; }
  }
  if (!n || !ch) { document.body.classList.remove('reading'); app().innerHTML = `<div class="wrap" style="padding-top:60px">${empty('ไม่พบตอนนี้', `<a class="btn ghost sm" href="#${n ? esc(base) : (src ? '/lustzone' : '/novels')}" style="margin-top:14px">กลับ</a>`)}</div>`; return; }
  const chs = (meta.chapters || []).filter(c => c.published !== false); const i = chs.findIndex(c => c.n === num);
  const prev = chs[i - 1], next = chs[i + 1];
  const pref = { ...PREF_DEF, ...store.get('lcu:reader', {}) };
  const text = ch.blocks.map(b => b.t === 'hr' ? '<hr>' : b.t === 'img' ? `<figure class="r-img"><img src="${esc(b.src)}" width="${b.w}" height="${b.h}" loading="lazy" decoding="async" alt="ภาพประกอบ" class="z"></figure>` : b.t === 'h' ? `<h2>${esc(b.x)}</h2>` : `<p>${esc(b.x).replace(/\n/g, '<br>')}</p>`).join('');
  const chars = ch.blocks.reduce((a, b) => a + (b.x || '').length, 0); const mins = Math.max(1, Math.round(chars / 800));
  app().innerHTML = `<div class="reader" id="rd">
    <div class="rbar"><a class="icon-btn" href="#${esc(base)}" aria-label="กลับไปหน้านิยาย">${ICON.back}</a>
      <div class="t">${esc(n.title)}<small>${chs.length > 1 ? esc(chLabel(ch, num)) : 'ตอนเดียวจบ'}</small></div>
      <button class="icon-btn" id="rtoc" aria-label="สารบัญ">${ICON.list}</button><button class="icon-btn" id="rset" aria-label="ตั้งค่าการอ่าน" aria-expanded="false">${ICON.gear}</button><div class="prog" id="rprog"></div></div>
    <div class="rpanel" id="rpanel" role="dialog" aria-label="ตั้งค่าการอ่าน">
      <div class="lbl">ขนาดตัวอักษร</div><div class="stepper"><button data-a="s-">ก-</button><output id="o-s"></output><button data-a="s+">ก+</button></div>
      <div class="lbl">ระยะบรรทัด</div><div class="stepper"><button data-a="l-">−</button><output id="o-l"></output><button data-a="l+">+</button></div>
      <div class="lbl">ธีม</div><div class="chips"><button class="chip" data-t="dark">มืด</button><button class="chip" data-t="sepia">ซีเปีย</button><button class="chip" data-t="light">สว่าง</button></div>
      <div class="lbl">แบบอักษร</div><div class="chips"><button class="chip" data-f="sans">ไม่มีหัว</button><button class="chip" data-f="serif">มีเชิง</button></div>
    </div>
    <article lang="th"><h1>${esc(chs.length > 1 ? chLabel(ch, num) : (ch.title || n.title))}</h1><div class="meta">${chs.length > 1 ? `ตอนที่ ${num} จาก ${chs.length}` : 'ตอนเดียวจบ'} · อ่านประมาณ ${mins} นาที</div>${text}</article>
    <nav class="rnav" aria-label="นำทางตอน">${prev ? `<a class="btn ghost" href="#${esc(base)}/${prev.n}">← ตอนก่อนหน้า</a>` : '<span></span>'}${next ? `<a class="btn" href="#${esc(base)}/${next.n}">ตอนถัดไป →</a>` : `<a class="btn ghost" href="#${esc(base)}">กลับสารบัญ</a>`}</nav>
  </div>`;
  const rd = $('#rd');
  const apply = () => {
    rd.style.setProperty('--r-size', pref.size + 'px'); rd.style.setProperty('--r-lh', pref.lh);
    rd.style.setProperty('--r-font', pref.font === 'serif' ? 'var(--f-serif)' : 'var(--f-body)');
    rd.classList.toggle('light', pref.theme === 'light'); rd.classList.toggle('sepia', pref.theme === 'sepia');
    $('#o-s').textContent = pref.size + 'px'; $('#o-l').textContent = pref.lh.toFixed(2);
    $$('#rpanel [data-t]').forEach(b => b.setAttribute('aria-pressed', b.dataset.t === pref.theme));
    $$('#rpanel [data-f]').forEach(b => b.setAttribute('aria-pressed', b.dataset.f === pref.font));
    store.set('lcu:reader', pref);
  };
  apply();
  $('#rset').onclick = () => { const on = $('#rpanel').classList.toggle('on'); $('#rset').setAttribute('aria-expanded', on); };
  $('#rtoc').onclick = () => go(base);
  $('#rpanel').onclick = e => { const b = e.target.closest('button'); if (!b) return;
    const a = b.dataset.a; if (a === 's-') pref.size = Math.max(14, pref.size - 1); if (a === 's+') pref.size = Math.min(30, pref.size + 1);
    if (a === 'l-') pref.lh = Math.max(1.4, +(pref.lh - .1).toFixed(2)); if (a === 'l+') pref.lh = Math.min(2.6, +(pref.lh + .1).toFixed(2));
    if (b.dataset.t) pref.theme = b.dataset.t; if (b.dataset.f) pref.font = b.dataset.f; apply(); };
  // progress
  const saved = progress()[pkey];
  if (saved && saved.n === num && saved.pos > .02) requestAnimationFrame(() => scrollTo(0, saved.pos * (document.documentElement.scrollHeight - innerHeight)));
  let tmr; const onScroll = () => {
    const h = document.documentElement.scrollHeight - innerHeight; const pos = h > 0 ? Math.min(1, scrollY / h) : 1;
    const bar = $('#rprog'); if (!bar) { removeEventListener('scroll', onScroll); return; } bar.style.width = (pos * 100) + '%';
    clearTimeout(tmr); tmr = setTimeout(() => { const all = progress(); all[pkey] = { n: num, pos, t: Date.now(), title: ch.title || '' }; store.set('lcu:progress', all); }, 400);
  };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  const onKey = e => { if (!$('#rd')) return removeEventListener('keydown', onKey); if (e.target.closest('input,textarea')) return;
    if (e.key === 'ArrowRight' && next) go(`${base}/${next.n}`); if (e.key === 'ArrowLeft' && prev) go(`${base}/${prev.n}`); };
  addEventListener('keydown', onKey);
  track({ type: 'chapter_view', novel: n.id, chapter: `${n.id}:${num}` });
}
