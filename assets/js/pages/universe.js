// Universe encyclopedia pages: home, hub, characters, profiles, organizations, generic articles.
import { S, X, $, $$, esc, strip, norm, img, title, firstImg, store, PATHS, HOME, volumes, storyHref, storyYears, be, fmt, isExt, loadNovels } from '../core.js';
import { ICON, pageHead, pathCrumbs, crumbs, secHead, charCard, pageCard, empty, secHTML, mergeLead, proseHTML, blockHTML, backlinksHTML } from '../ui.js';

const app = () => $('#app');

/* ================================================================ HOME */
// timeline preview: 3 different series, 3 different characters (fallback before novel covers load)
function tlPicks(TL) {
  const out = [], usedSeries = new Set(), usedChars = new Set();
  for (const s of TL.stories) {
    if (s.lust || usedSeries.has(s.series.k)) continue;
    const c = (s.chars || []).find(c => c.img && !usedChars.has(c.p)); if (!c) continue;
    out.push({ s, c }); usedSeries.add(s.series.k); usedChars.add(c.p); if (out.length === 3) break;
  }
  return out;
}
export function renderHome() {
  const D = S.D, TL = S.TL;
  const intro = D.pages[HOME].secs.find(x => x.some(b => b.t === 'h' && /สารานุกรม/.test(b.x))) || [];
  const tagline = strip(intro.find(b => b.t === 'p' && /จักรวาลเรื่องราว/.test(strip(b.x)))?.x || 'จักรวาลเรื่องราวแนวซุปเปอร์ฮีโร่และวายร้ายสัญชาติไทย สไตล์ดาร์ก ดิบ เดือด');
  const withImg = D.chars.filter(c => c.img);
  const mosaic = [...withImg.filter((_, i) => i % 5 === 0)].slice(0, 32);
  const featured = withImg.filter(c => c.cat === '/ตวละคร/ปศาจ-เทพ').slice(0, 5).concat(withImg.filter(c => c.cat === '/ตวละคร/มนษย' && !c.tag).slice(0, 5));
  const groups = D.groups.map(g => ({ p: g, m: (X.groupMembers.get(g) || []).length, im: firstImg(g) })).filter(g => g.im).sort((a, b) => b.m - a.m).slice(0, 6);
  const vols = volumes();
  const mainStories = TL ? TL.stories.filter(s => !s.lust) : [];
  const yrs = TL ? TL.events.filter(e => e.y && !TL.stories.find(s => s.no === e.st)?.lust).map(e => e.y) : [];
  const stats = [[D.chars.length, 'ตัวละคร'], [D.groups.length, 'กลุ่ม & องค์กร'], [mainStories.length, 'เรื่องในไทม์ไลน์'], [vols.length, 'Volumes']];

  app().innerHTML = `
  <section class="hero" aria-labelledby="hero-t">
    <div class="mosaic" aria-hidden="true">${mosaic.map(c => img(c.img, { alt: '' })).join('')}</div>
    <div class="in">
      <img class="logo" src="assets/img/lcu-logo.webp" width="254" height="120" alt="LCU" fetchpriority="high">
      <h1 id="hero-t">LOW CLASS UNIVERSE</h1>
      <p class="tag">${esc(tagline)}</p>
      <div class="cta"><a class="btn" href="#/universe">เข้าสู่จักรวาล ${ICON.arrow}</a><a class="btn ghost" href="#/novels">อ่านนิยาย LCU</a></div>
      <div class="stats">${stats.map(([n, l]) => `<div><b>${fmt(n)}</b><span>${l}</span></div>`).join('')}</div>
    </div>
  </section>
  <div class="wrap">
    <nav class="quick" aria-label="ทางลัด">
      <a class="qn" href="#/ตวละคร"><span class="k">DATABASE</span><b>ตัวละคร</b><small>มนุษย์ อมนุษย์ ปีศาจ เทพ และหิมพานต์</small></a>
      <a class="qn" href="#/กลม-องคกร"><span class="k">FACTIONS</span><b>กลุ่ม & องค์กร</b><small>แก๊ง หน่วยข่าวกรอง อิลลูมินาติ</small></a>
      <a class="qn" href="#/universe/timeline"><span class="k">CHRONICLE</span><b>ไทม์ไลน์</b><small>${fmt(mainStories.length)} เรื่อง เรียงตามเวลา</small></a>
      <a class="qn" href="#/novels"><span class="k">LIBRARY</span><b>นิยาย</b><small>${vols.map(v => 'Vol.' + v.n).join(' · ')}</small></a>
    </nav>

    <section class="section reveal">${secHead('ตัวละครเด่น', 'ดูทั้งหมด ' + D.chars.length, '/ตวละคร')}
      <div class="grid">${featured.map(c => charCard(c)).join('')}</div></section>

    <section class="section reveal">${secHead('LCU Volumes', 'คลังนิยาย', '/novels')}
      <div class="vols">${vols.map(v => `<a class="vol" href="#/novels/vol-${v.n}" data-n="${v.n}">
        <span class="eyebrow">Volume ${v.n}</span><div class="h3">${esc(v.name)}</div>
        <div class="meta">${v.stories.length ? `${v.stories.length} เรื่องในไทม์ไลน์` : v.planned.length ? `${v.planned.length} เรื่องในแผนการสร้าง` : ''}${v.links.length ? ` · อ่านได้ ${v.links.length} แพลตฟอร์ม` : ''}</div>
        <div class="dots">${[...new Set(v.stories.map(s => s.series.c))].map(c => `<i style="--c:${c}"></i>`).join('')}</div></a>`).join('')}</div></section>

    <section class="section reveal">${secHead('กลุ่ม & องค์กร', 'ดูทั้งหมด ' + D.groups.length, '/กลม-องคกร')}
      <div class="grid lg">${groups.map(g => pageCard(g.p, { sub: g.m ? `${g.m} สมาชิกในฐานข้อมูล` : '', src: g.im })).join('')}</div></section>

    ${TL ? `<section class="section reveal">${secHead('Universe Timeline', 'เปิดไทม์ไลน์', '/universe/timeline')}
      <div class="feature"><div>
        <span class="eyebrow">พ.ศ. ${be(Math.min(...yrs))} – ${be(Math.max(...yrs))}</span>
        <div class="h2" style="margin:10px 0 12px">เหตุการณ์ ${fmt(TL.events.filter(e => !String(e.st).includes('.') && typeof e.st === 'number').length)} รายการ ใน ${mainStories.length} เรื่อง</div>
        <p class="muted">เรียงตามเวลาหรือตามเรื่อง กรองตามซีรีส์ และกดชื่อตัวละครเพื่อไปยังโปรไฟล์ได้ทันที</p>
        <div class="chips" style="margin-top:18px">${TL.series.filter(s => s.k !== 'lust').map(s => `<a class="chip" href="#/universe/timeline?s=${s.k}"><i style="--c:${s.c}"></i>${esc(s.n)}</a>`).join('')}</div>
      </div><div class="pics" id="tlpics">${tlPicks(TL).map(({ s, c }) => `<a href="#${storyHref(s)}" aria-label="${esc(s.name)}">${img(c.img, { alt: s.name })}</a>`).join('')}</div></div></section>` : ''}

    <section class="section reveal" id="updates">${secHead('อัปเดตล่าสุด')}<div id="upd" class="stack"><div class="skel" style="height:64px"></div></div></section>

    <section class="section reveal">${secHead('เกี่ยวกับ LCU', 'อ่านต่อ', '/about')}
      <div class="prose">${intro.filter(b => b.t === 'p').slice(0, 3).map(blockHTML).join('')}</div></section>
  </div>`;

  // replace the preview with real novel covers (first novel of 3 different series)
  if (TL) loadNovels().then(nv => {
    const el = $('#tlpics'); if (!el) return; const used = new Set(); const picks = [];
    for (const s of TL.stories) {
      if (s.lust || used.has(s.series.k)) continue;
      const n = (nv.novels || []).find(n => !n.adult && n.cover && String(n.story_no) === String(s.no)); if (!n) continue;
      picks.push({ s, n }); used.add(s.series.k); if (picks.length === 3) break;
    }
    if (picks.length === 3) el.innerHTML = picks.map(({ s, n }) => `<a href="#/novels/${esc(n.slug)}" aria-label="${esc(n.title)}"><img src="${esc(n.cover)}" alt="${esc(n.title)}" loading="lazy" decoding="async"></a>`).join('');
  }).catch(() => {});
  fetch('updates.json').then(r => r.ok ? r.json() : []).then(u => {
    const el = $('#upd'); if (!el) return;
    el.innerHTML = u.length ? u.slice(0, 5).map(x => `<div class="item" style="cursor:default"><div class="th ph">${esc(x.date.slice(5).replace('-', '/'))}</div><div><div class="t">${esc(x.title)}</div><div class="d">${esc(x.detail || '')}</div></div></div>`).join('') : empty('ยังไม่มีบันทึกอัปเดต');
  }).catch(() => { const el = $('#upd'); if (el) el.innerHTML = empty('โหลดบันทึกอัปเดตไม่สำเร็จ'); });
}

/* ================================================================ UNIVERSE HUB */
export function renderUniverse() {
  const D = S.D, TL = S.TL;
  const cats = D.cats.filter(c => D.pages[c]);
  const tiles = [
    ['ตัวละคร', '/ตวละคร', `${D.chars.length} ตัวละคร`, firstImg('/ตวละคร/ปศาจ-เทพ') || D.chars[0].img],
    ['กลุ่ม & องค์กร', '/กลม-องคกร', `${D.groups.length} กลุ่ม`, firstImg('/กลม-องคกร/อลลมนาต')],
    ['สถานที่ & ต่างโลก', PATHS.worlds, 'โลกหิมพานต์ · สวรรค์ & นรก', firstImg(PATHS.himmapan)],
    ['เทคโนโลยี & อาวุธ', PATHS.tech, 'Lore · อาวุธ · นวัตกรรม', firstImg(PATHS.tech)],
  ];
  app().innerHTML = pageHead({ crumbsHTML: crumbs([['หน้าแรก', '/'], ['Universe', null]]), eyebrow: 'Encyclopedia', h1: 'LOW CLASS UNIVERSE', sub: 'ฐานข้อมูลจักรวาล LCU ตัวละคร กลุ่มและองค์กร สถานที่ ตำนาน และลำดับเหตุการณ์ทั้งหมด' }) + `
  <div class="wrap">
    <section class="section"><div class="grid lg">${tiles.map(t => `<a class="card wide" href="#${t[1]}"><div class="art">${img(t[3], { alt: t[0] })}</div><div class="cap"><div class="nm" style="font-size:19px">${t[0]}</div><div class="sb">${t[2]}</div></div></a>`).join('')}</div></section>
    <section class="section">${secHead('ประเภทตัวละคร')}
      <div class="grid">${cats.map(c => `<a class="card" href="#${c}"><div class="art">${img(firstImg(c) || D.chars.find(x => x.cat === c)?.img, { alt: title(c) })}</div><div class="cap"><div class="nm">${esc(title(c))}</div><div class="sb">${D.chars.filter(x => x.cat === c).length} ตัวละคร</div></div></a>`).join('')}</div></section>
    <section class="section">${secHead('Chronicle')}
      <div class="grid lg">
        <a class="card text" href="#/universe/timeline"><span class="eyebrow">Timeline</span><div class="h3" style="margin-top:8px">ไทม์ไลน์จักรวาล</div><p>${TL ? `${TL.stories.filter(s => !s.lust).length} เรื่อง · ${TL.series.filter(s => s.k !== 'lust').length} ซีรีส์` : ''} เรียงตามเวลาหรือตามเรื่อง</p></a>
        <a class="card text" href="#/universe/stories"><span class="eyebrow">Stories</span><div class="h3" style="margin-top:8px">ฐานข้อมูลเรื่อง & Volume</div><p>ทุกเรื่องใน LCU แยกตาม Volume พร้อมตัวละครที่เกี่ยวข้อง</p></a>
        <a class="card text" href="#${PATHS.plan}"><span class="eyebrow">Roadmap</span><div class="h3" style="margin-top:8px">แผนเรื่องใหม่</div><p>เรื่องที่กำลังจะมาในจักรวาล LCU และ Spin-Off</p></a>
      </div></section>
  </div>`;
}

/* ================================================================ CHARACTERS */
export function renderChars(cat, qs) {
  const D = S.D;
  const cats = D.cats.filter(c => D.pages[c]);
  const groups = [...new Set(D.chars.flatMap(c => c.g))].sort((a, b) => title(a).localeCompare(title(b), 'th'));
  const st = { cat: cat || '', g: qs.get('g') || '', q: qs.get('q') || '', spin: qs.get('spin') || '', sort: store.get('lcu:csort', 'src') };
  const headP = cat || PATHS.chars;
  app().innerHTML = pageHead({ crumbsHTML: pathCrumbs(headP), eyebrow: 'Character Database', h1: cat ? title(cat) : 'ตัวละคร', sub: `${D.chars.length} ตัวละครในจักรวาล LCU` }) + `
  <div class="wrap"><section class="section">
    <div class="toolbar">
      <label class="field">${ICON.search}<span class="sr-only">ค้นหาตัวละคร</span><input id="cq" type="search" placeholder="ค้นหาชื่อ นามแฝง หรือคำในประวัติ…" value="${esc(st.q)}" autocomplete="off"></label>
      <label><span class="sr-only">เรียงลำดับ</span><select id="cs" class="select"><option value="src">เรียงตามต้นฉบับ</option><option value="az">ชื่อ ก–ฮ / A–Z</option></select></label>
      <span class="count" id="cc" role="status" aria-live="polite"></span>
    </div>
    <div class="filters">
      <div><div class="lbl">ประเภท</div><div class="chips" id="cf"><button class="chip" data-c="">ทั้งหมด <span class="n">${D.chars.length}</span></button>${cats.map(c => `<button class="chip" data-c="${c}">${esc(title(c))} <span class="n">${D.chars.filter(x => x.cat === c).length}</span></button>`).join('')}<button class="chip" data-spin="1">Spin-off <span class="n">${D.chars.filter(x => x.tag === 'Spin-off').length}</span></button></div></div>
      <details class="more-f" ${st.g ? 'open' : ''}><summary>กรองตามกลุ่ม / องค์กร ${ICON.down}</summary><div class="chips" id="gf"><button class="chip" data-g="">ทุกกลุ่ม</button>${groups.map(g => `<button class="chip" data-g="${g}">${esc(title(g))}</button>`).join('')}</div></details>
    </div>
    <div class="grid" id="cg"></div>
  </section></div>`;
  $('#cs').value = st.sort;
  const hay = new Map(D.chars.map(c => [c, norm(c.n + ' ' + c.q)]));
  const draw = () => {
    const q = norm(st.q);
    let list = D.chars.filter(c => (!st.cat || c.cat === st.cat) && (!st.g || c.g.includes(st.g)) && (!st.spin || c.tag === 'Spin-off') && (!q || hay.get(c).includes(q)));
    if (st.sort === 'az') list = [...list].sort((a, b) => a.n.localeCompare(b.n, 'th'));
    $('#cg').innerHTML = list.length ? list.map((c, i) => charCard(c, { eager: i < 6 })).join('') : empty('ไม่พบตัวละคร', '<p>ลองเปลี่ยนคำค้นหรือล้างตัวกรอง</p><button class="btn ghost sm" id="clr" style="margin-top:14px">ล้างตัวกรอง</button>');
    $('#cc').textContent = `${list.length} ตัวละคร`;
    $$('#cf .chip[data-c]').forEach(e => e.setAttribute('aria-pressed', e.dataset.c === st.cat && !st.spin));
    $('#cf .chip[data-spin]').setAttribute('aria-pressed', !!st.spin);
    $$('#gf .chip').forEach(e => e.setAttribute('aria-pressed', e.dataset.g === st.g));
    const clr = $('#clr'); if (clr) clr.onclick = () => { Object.assign(st, { cat: '', g: '', q: '', spin: '' }); $('#cq').value = ''; sync(); draw(); };
  };
  const sync = () => {
    const p = new URLSearchParams(); if (st.g) p.set('g', st.g); if (st.spin) p.set('spin', 1); if (st.q) p.set('q', st.q);
    history.replaceState(null, '', '#' + (st.cat || PATHS.chars) + (p.toString() ? '?' + p : ''));
  };
  $('#cf').onclick = e => { const c = e.target.closest('.chip'); if (!c) return; if (c.dataset.spin) { st.spin = st.spin ? '' : '1'; } else { st.cat = c.dataset.c; st.spin = ''; } sync(); draw(); };
  $('#gf').onclick = e => { const c = e.target.closest('.chip'); if (!c) return; st.g = c.dataset.g; sync(); draw(); };
  let t; $('#cq').oninput = e => { clearTimeout(t); t = setTimeout(() => { st.q = e.target.value; sync(); draw(); }, 120); };
  $('#cs').onchange = e => { st.sort = e.target.value; store.set('lcu:csort', st.sort); draw(); };
  draw();
}

/* ================================================================ CHARACTER PROFILE */
// Labels that already exist on character pages ("ชื่อ ...", "เพศ ...") → dossier rows.
const FIELD = ['ชื่อ', 'นามแฝง', 'ฉายา', 'ตัวจริง', 'เพศ', 'เผ่าพันธุ์', 'ยศ', 'ศักดิ์', 'ตำแหน่งในนรก', 'ตำแหน่งในสวรรค์', 'ตำแหน่ง', 'เกิดวันที่', 'วันเกิด', 'ความสามารถ', 'ศัตรู', 'รูปลักษณ์', 'ความหมายของชื่อ', 'บทบาทนอกนิยาย'];
const fieldRe = new RegExp('^(' + FIELD.join('|') + ')\\s+(\\S[\\s\\S]*)$');
function splitField(b) {
  if (b.t !== 'p') return null;
  const plain = strip(b.x).replace(/ /g, ' ').trim(); if (plain.length > 420) return null;
  const m = plain.match(fieldRe); if (!m) return null;
  // remove the label from the original HTML (keeps links/bold inside the value)
  let html = b.x.replace(new RegExp('^((?:\\s|<[^>]+>)*)' + m[1]), '$1').replace(/^((?:<[^>]+>)*)(?:<\/[^>]+>)+/, '$1').replace(/<(b|i)>\s*<\/\1>/g, '').trim();
  return { k: m[1], v: html };
}
export function renderCharacter(p, c) {
  const pg = S.D.pages[p];
  let secs = pg.secs.slice();
  if (secs[0]?.length === 1 && secs[0][0].t === 'h' && norm(secs[0][0].x) === norm(pg.title)) secs.shift();
  secs = mergeLead(secs);
  // portrait = first unlinked image of the first section that has one
  const li = secs.findIndex(s => s.some(b => b.t === 'img' && !b.href));
  const lead = li >= 0 && li <= 1 ? secs[li] : null;
  const portrait = lead?.find(b => b.t === 'img' && !b.href)?.src || c.img;
  const leadText = lead ? lead.filter(b => b !== lead.find(x => x.t === 'img' && !x.href)) : [];
  const rest = secs.filter(s => s !== lead);
  const fields = [], body = [];
  for (const b of leadText) { const f = splitField(b); if (f) fields.push(f); else body.push(b); }
  const alias = fields.filter(f => f.k === 'นามแฝง' || f.k === 'ฉายา').map(f => strip(f.v)).join(' · ');
  // story appearances (linked to the Story Database when the title matches a timeline story)
  const stories = c.stories || [];
  const grp = c.g.map(x => `<a class="chip" href="#${x}">${esc(title(x))}</a>`).join('');
  const bodyHTML = body.map((b, i) => {
    const nx = body[i + 1];
    if (b.t === 'p' && /^มีบทบาทในเรื่อง/.test(strip(b.x).trim()) && stories.length)
      return `<div class="lbl-h">${b.x}</div>`;
    if (b.t === 'list' && /^มีบทบาทในเรื่อง/.test(strip(body.slice(0, i).reverse().find(x => x.t !== 'list')?.x || '').trim()) && stories.length) {
      return `<div class="appear">${b.items.map(it => { const s = stories.find(s => norm(it).includes(norm(s.name))); return s ? `<a href="#${storyHref(s)}" style="--c:${s.series.c}"><span class="dot"></span><span>${it}</span></a>` : `<span><span class="dot"></span><span>${it}</span></span>`; }).join('')}</div>`;
    }
    if (b.t === 'p' && nx?.t === 'list' && strip(b.x).trim().length <= 30) return `<div class="lbl-h">${b.x}</div>`;
    return blockHTML(b);
  }).join('');

  app().innerHTML = `<article>` + pageHead({
    crumbsHTML: pathCrumbs(p), eyebrow: esc(title(c.cat)) + (c.tag ? ' · ' + esc(c.tag) : ''), h1: pg.title, bg: portrait,
    extra: `${alias ? `<div class="alias">${esc(alias)}</div>` : ''}<div class="chips" style="margin-top:16px"><a class="chip" href="#${c.cat}">${esc(title(c.cat))}</a>${grp}</div>`,
  }) + `<div class="wrap">
    <div class="profile">
      <div class="portrait"><div class="frame">${img(portrait, { cls: 'z', alt: pg.title, eager: true })}</div></div>
      <div>
        ${fields.length ? `<dl class="dossier"><div class="head"><span class="eyebrow">Character File</span><span class="badge">LCU</span></div>${fields.map(f => `<dt>${esc(f.k)}</dt><dd>${f.v}</dd>`).join('')}${c.g.length ? `<dt>สังกัด</dt><dd>${c.g.map(x => `<a href="#${x}">${esc(title(x))}</a>`).join(', ')}</dd>` : ''}</dl>` : ''}
        <div class="prose">${bodyHTML}</div>
      </div>
    </div>
    ${rest.map(s => secHTML(s, pg.title)).join('')}
    ${stories.length ? `<section class="section">${secHead('ปรากฏในไทม์ไลน์')}<div class="chips">${stories.map(s => `<a class="chip" href="#${storyHref(s)}"><i style="--c:${s.series.c}"></i>${esc(s.name)}</a>`).join('')}</div></section>` : ''}
    ${backlinksHTML(p, [pg.parent])}
  </div></article>`;
}

/* ================================================================ ORGANIZATIONS */
export function renderGroups(qs) {
  const D = S.D;
  const items = D.groups.map(g => ({ p: g, n: title(g), im: firstImg(g), m: (X.groupMembers.get(g) || []).length, t: norm(title(g) + ' ' + strip(D.pages[g].secs.flat().map(b => b.x || '').join(' ')).slice(0, 400)) }));
  // the original index page (categories, cards and the lists of other gangs / organisations) is shown when not searching
  let secs = D.pages[PATHS.groups].secs.slice();
  if (secs[0]?.length === 1 && secs[0][0].t === 'h' && /กลุ่ม/.test(strip(secs[0][0].x)) && norm(secs[0][0].x) === norm(D.pages[PATHS.groups].title)) secs.shift();
  const full = secs.map(s => secHTML(s, 'กลุ่ม & องค์กร')).join('');
  app().innerHTML = pageHead({ crumbsHTML: pathCrumbs(PATHS.groups), eyebrow: 'Factions & Organizations', h1: 'กลุ่ม & องค์กร', sub: 'แก๊ง หน่วยข่าวกรอง องค์กรลับ และขั้วอำนาจในจักรวาล LCU' }) + `
  <div class="wrap"><section class="section">
    <div class="toolbar"><label class="field">${ICON.search}<span class="sr-only">ค้นหากลุ่ม</span><input id="gq" type="search" placeholder="ค้นหากลุ่ม / องค์กร…" value="${esc(qs.get('q') || '')}"></label><span class="count" id="gc" role="status"></span></div>
    <div id="gg"></div></section></div>`;
  const draw = q => {
    q = norm(q);
    if (!q) { $('#gg').innerHTML = full; $('#gc').textContent = `${items.length} กลุ่มที่มีหน้าข้อมูล`; return; }
    const l = items.filter(i => i.t.includes(q));
    $('#gg').innerHTML = l.length ? `<div class="grid lg">${l.map(i => pageCard(i.p, { sub: i.m ? `${i.m} สมาชิกในฐานข้อมูล` : '', src: i.im })).join('')}</div>` : empty('ไม่พบกลุ่มที่ค้นหา');
    $('#gc').textContent = l.length + ' กลุ่ม';
  };
  let t; $('#gq').oninput = e => { clearTimeout(t); t = setTimeout(() => draw(e.target.value), 120); }; draw($('#gq').value);
}

/* ================================================================ GENERIC ARTICLE (orgs, worlds, tech, plan …) */
const HELL = [['3 เสาหลักแห่งนรก', 'ซิซ ลิเวียธาน เบเฮโมท — สิ่งมีชีวิตดึกดำบรรพ์ที่แข็งแกร่งกว่าซาตาน ไม่มีราชาองค์ใดสั่งการได้', 'เหนือทุกอำนาจ', '/กลม-องคกร/3-เสาหลกแหงนรก'], ['ซาตาน', 'ราชาแห่งนรก บาปแห่งโทสะ ผู้ชนะสงครามนรกชั้นที่ 5', 'ราชา', '/ตวละคร/ปศาจ-เทพ/ซาตาน-บาปแหงโทสะ'], ['มหาบาป 7 ประการ', 'ปีศาจตัวแทนบาปทั้งเจ็ด ตั้งแต่โทสะจนถึงเกียจคร้าน', 'บาป', '/กลม-องคกร/มหาบาป-7-ประการ'], ['4 ราชินีแห่งปีศาจ', 'ลิลิธ อากรัท บัท มาห์ลัต นาอามาห์ และไอเช็ธ เซนูนิม', 'ราชินี', '/กลม-องคกร/4-ราชนแหงปศาจ'], ['เดียโบล', 'อดีตบาปแห่งโทสะ ผู้แพ้สงครามและถูกเนรเทศสู่โลกันตนรก', 'ผู้ถูกเนรเทศ', '/ตวละคร/ปศาจ-เทพ/เดยโบล'], ['Midnight Lust', 'อาณาจักรของปีศาจราคะที่แฝงตัวอยู่ในโลกมนุษย์', 'โลกมนุษย์', '/กลม-องคกร/midnight-lust']];
export function renderPage(p) {
  const D = S.D, pg = D.pages[p];
  if (!pg) return renderNotFound();
  let secs = pg.secs.slice();
  if (secs[0]?.length === 1 && secs[0][0].t === 'h' && norm(secs[0][0].x) === norm(pg.title)) secs.shift();
  let pre = '';
  const isGroup = p.startsWith(PATHS.groups + '/');
  if (p === PATHS.heavenHell) pre += `<section class="section">${secHead('ขั้วอำนาจแห่งนรก')}<div class="grid lg">${HELL.map(t => `<a class="card text" href="#${t[3]}"><span class="badge red">${t[2]}</span><div class="h3" style="margin-top:12px">${t[0]}</div><p>${t[1]}</p></a>`).join('')}</div></section>`;
  if (p === PATHS.plan) {
    secs = secs.filter(s => !(s.length === 1 && s[0].t === 'h' && /TIMELINE/i.test(s[0].x)));
    pre += `<section class="section"><div class="notice">ลำดับเรื่องที่สร้างเสร็จแล้วทั้งหมดอยู่ใน <a href="#/universe/timeline">ไทม์ไลน์</a> และ <a href="#/universe/stories">ฐานข้อมูลเรื่อง</a> · 🔲 ยังไม่เริ่ม · ⌛ กำลังดำเนินการ · ✅ เสร็จแล้ว</div></section>`;
  }
  const kids = Object.keys(D.pages).filter(k => D.pages[k].parent === p && !X.charBy.has(k));
  const bg = firstImg(p);
  secs = mergeLead(secs);
  app().innerHTML = `<article>${pageHead({ crumbsHTML: pathCrumbs(p), eyebrow: isGroup ? 'Faction' : p.startsWith(PATHS.worlds) ? 'Location' : p === PATHS.tech ? 'Lore & Technology' : 'Encyclopedia', h1: title(p), bg })}
  <div class="wrap">${pre}${secs.map(s => secHTML(s, title(p))).join('')}
  ${kids.length && !secs.some(s => s.some(b => b.href && kids.includes(b.href.slice(1)))) ? `<section class="section">${secHead('หน้าย่อย')}<div class="grid lg">${kids.map(k => pageCard(k)).join('')}</div></section>` : ''}
  ${backlinksHTML(p, [pg.parent])}</div></article>`;
}

export function renderNotFound() {
  app().innerHTML = pageHead({ crumbsHTML: crumbs([['หน้าแรก', '/'], ['ไม่พบหน้า', null]]), eyebrow: '404', h1: 'ไม่พบหน้านี้ในจักรวาล' }) +
    `<div class="wrap"><section class="section">${empty('หน้านี้อาจถูกย้ายหรือไม่มีอยู่จริง', '<p>ลองค้นหาด้านบน หรือกลับไปยังหน้าแรก</p><a class="btn ghost sm" style="margin-top:14px" href="#/">กลับหน้าแรก</a>', '404')}</section></div>`;
}
