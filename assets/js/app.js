// App shell: header, navigation, router, global behaviours.
import { CONFIG } from './config.js';
import { S, X, $, $$, esc, title, loadCore, PATHS, HOME, firstImg, go } from './core.js';
import { ICON, item } from './ui.js';
import { renderHome, renderUniverse, renderChars, renderCharacter, renderGroups, renderPage, renderNotFound } from './pages/universe.js';
import { renderTimeline, renderStories, renderStory } from './pages/chronicle.js';
import { renderLibrary, renderVolume, renderNovel, renderReader } from './pages/novels.js';
import { renderLustzone } from './pages/lustzone.js';
import { renderSearch, buildIndex, query, resultHTML, TYPES } from './pages/search.js';
import { renderAbout } from './pages/about.js';
import { renderStats } from './stats.js';

/* ------------------------------------------------------------------ navigation */
const NAV = [
  { k: 'home', t: 'Home', h: '/' },
  { k: 'universe', t: 'Universe', h: '/universe' },
  { k: 'novels', t: 'Novels', h: '/novels' },
  { k: 'lustzone', t: 'LustZone', h: '/lustzone' },
  { k: 'about', t: 'About LCU', h: '/about' },
];
function universeMenu() {
  const D = S.D; const cats = D.cats.filter(c => D.pages[c]);
  const sub = list => `<div class="sub">${list.map(([t, h]) => `<a href="#${h}">${esc(t)}</a>`).join('')}</div>`;
  return [
    [`<a href="#/ตวละคร"><b>ตัวละคร</b><small>${D.chars.length} ตัวละคร · มนุษย์ ปีศาจ เทพ หิมพานต์</small></a>`, sub(cats.map(c => [title(c), c]))],
    [`<a href="#/กลม-องคกร"><b>กลุ่ม & องค์กร</b><small>${D.groups.length} กลุ่ม · แก๊ง หน่วยข่าวกรอง องค์กรลับ</small></a>`, ''],
    [`<a href="#${PATHS.worlds}"><b>สถานที่ & ต่างโลก</b><small>ดินแดนในจักรวาล LCU</small></a>`, sub([[title(PATHS.himmapan), PATHS.himmapan], [title(PATHS.heavenHell), PATHS.heavenHell]])],
    [`<a href="#${PATHS.tech}"><b>Lore: เทคโนโลยี & อาวุธ</b><small>อาวุธ ยุทโธปกรณ์ และนวัตกรรม</small></a>`, ''],
    [`<a href="#/universe/timeline"><b>ไทม์ไลน์</b><small>เหตุการณ์ทั้งจักรวาลตามลำดับเวลา</small></a>`, ''],
    [`<a href="#/universe/stories"><b>เรื่อง & Volume</b><small>ฐานข้อมูลเรื่องราวทั้งหมด</small></a>`, sub([['แผนเรื่องใหม่', PATHS.plan]])],
  ].map(([a, s]) => `<div>${a}${s}</div>`).join('');
}
function headerHTML() {
  return `<div class="wrap">
    <a class="brand" href="#/" aria-label="LOW CLASS UNIVERSE หน้าแรก"><img src="assets/img/lcu-logo.webp" width="254" height="120" alt=""><span>LOW CLASS UNIVERSE</span></a>
    <nav class="nav" aria-label="เมนูหลัก">
      <a href="#/" data-k="home">Home</a>
      <div class="dd" id="dd-u"><button aria-expanded="false" aria-controls="mega-u" data-k="universe">Universe ${ICON.down}</button><div class="mega" id="mega-u">${universeMenu()}</div></div>
      <a href="#/novels" data-k="novels">Novels</a>
      <a href="#/lustzone" data-k="lustzone" class="lz-link">LustZone <b>18+</b></a>
      <a href="#/about" data-k="about">About LCU</a>
    </nav>
    <div class="hdr-tools">
      <form class="qbox" role="search" id="qf"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
        <input id="qi" name="q" type="search" placeholder="ค้นหาในจักรวาล…" aria-label="ค้นหาทั้งเว็บ" autocomplete="off" aria-controls="qpop" aria-expanded="false"><kbd aria-hidden="true">/</kbd>
        <div class="qpop" id="qpop" role="listbox"></div></form>
      <a class="icon-btn q-mobile" href="#/ค้นหา" aria-label="ค้นหา">${ICON.search}</a>
      <button class="icon-btn burger" id="burger" aria-label="เปิดเมนู" aria-expanded="false" aria-controls="drawer">${ICON.menu}</button>
    </div></div>`;
}
function drawerHTML() {
  const D = S.D; const cats = D.cats.filter(c => D.pages[c]);
  const a = (t, h, sub = false) => `<a href="#${h}"${sub ? ' class="sub"' : ''}>${esc(t)}</a>`;
  return `<div class="scrim" data-close></div><div class="panel" role="dialog" aria-modal="true" aria-label="เมนู">
    <div class="top"><a class="brand" href="#/"><img src="assets/img/lcu-logo.webp" width="254" height="120" alt="LCU"></a><button class="icon-btn" data-close aria-label="ปิดเมนู">${ICON.close}</button></div>
    <form id="dq" role="search"><input name="q" type="search" placeholder="ค้นหาในจักรวาล…" aria-label="ค้นหา"></form>
    <nav aria-label="เมนูมือถือ">${a('Home', '/')}
      <div class="grp">UNIVERSE</div>${a('ภาพรวม Universe', '/universe')}${a('ตัวละคร', '/ตวละคร')}${cats.map(c => a(title(c), c, true)).join('')}
      ${a('กลุ่ม & องค์กร', '/กลม-องคกร')}${a('สถานที่ & ต่างโลก', PATHS.worlds)}${a(title(PATHS.himmapan), PATHS.himmapan, true)}${a(title(PATHS.heavenHell), PATHS.heavenHell, true)}
      ${a('Lore: เทคโนโลยี & อาวุธ', PATHS.tech)}${a('ไทม์ไลน์', '/universe/timeline')}${a('เรื่อง & Volume', '/universe/stories')}${a('แผนเรื่องใหม่', PATHS.plan, true)}
      <div class="grp">LIBRARY</div>${a('Novels', '/novels')}${a('LustZone 18+', '/lustzone')}${a('สถิติการอ่าน', '/stats')}
      <div class="grp">LCU</div>${a('About LCU', '/about')}</nav></div>`;
}
function footerHTML() {
  return `<div class="wrap"><div class="cols4">
    <div><a class="brand" href="#/"><img src="assets/img/lcu-logo.webp" width="254" height="120" alt="LCU"></a><p style="margin-top:12px;max-width:34ch">สารานุกรมและคลังนิยายของจักรวาล LOW CLASS UNIVERSE — จักรวาลซุปเปอร์ฮีโร่และวายร้ายสัญชาติไทย</p></div>
    <div><h4>Universe</h4><a href="#/ตวละคร">ตัวละคร</a><a href="#/กลม-องคกร">กลุ่ม & องค์กร</a><a href="#${PATHS.worlds}">สถานที่</a><a href="#/universe/timeline">ไทม์ไลน์</a><a href="#/universe/stories">เรื่อง & Volume</a></div>
    <div><h4>Library</h4><a href="#/novels">นิยาย</a><a href="#/lustzone">LustZone 18+</a><a href="#/stats">สถิติการอ่าน</a></div>
    <div><h4>LCU</h4><a href="#/about">About LCU</a><a href="https://patreon.com/LowClassUniverse" target="_blank" rel="noopener">Patreon</a><a href="https://ko-fi.com/lowclassuniverselcu" target="_blank" rel="noopener">Ko-fi</a></div>
  </div><div class="legal"><span>© LOW CLASS UNIVERSE (LCU) · ภาพประกอบบางส่วนสร้างด้วย AI</span><span>เนื้อหามีสปอยล์ · LustZone สำหรับผู้มีอายุ 18 ปีขึ้นไป</span></div></div>`;
}

/* ------------------------------------------------------------------ header behaviour */
function wireHeader() {
  const dd = $('#dd-u'), btn = dd.querySelector('button');
  const setDD = on => { dd.classList.toggle('open', on); btn.setAttribute('aria-expanded', on); };
  btn.onclick = e => { e.stopPropagation(); setDD(!dd.classList.contains('open')); };
  let ht; dd.onmouseenter = () => { clearTimeout(ht); if (matchMedia('(hover:hover)').matches) setDD(true); };
  dd.onmouseleave = () => { ht = setTimeout(() => setDD(false), 160); };
  document.addEventListener('click', e => { if (!dd.contains(e.target)) setDD(false); if (!$('#qf').contains(e.target)) qpop(false); });
  dd.addEventListener('keydown', e => { if (e.key === 'Escape') { setDD(false); btn.focus(); } });
  // drawer
  const dr = $('#drawer'), bg = $('#burger');
  const setDrawer = on => { dr.classList.toggle('on', on); bg.setAttribute('aria-expanded', on); document.body.style.overflow = on ? 'hidden' : ''; if (on) dr.querySelector('[data-close].icon-btn').focus(); };
  bg.onclick = () => setDrawer(true);
  dr.addEventListener('click', e => { if (e.target.closest('[data-close]') || e.target.closest('a')) setDrawer(false); });
  dr.addEventListener('keydown', e => { if (e.key === 'Escape') { setDrawer(false); bg.focus(); } });
  $('#dq').onsubmit = e => { e.preventDefault(); setDrawer(false); go('/ค้นหา?q=' + encodeURIComponent(e.target.q.value.trim())); };
  // instant search
  const qi = $('#qi'); let t, sel = -1;
  $('#qf').onsubmit = e => { e.preventDefault(); const q = qi.value.trim(); qpop(false); qi.blur(); go('/ค้นหา?q=' + encodeURIComponent(q)); };
  qi.addEventListener('focus', () => buildIndex());
  qi.addEventListener('input', () => { clearTimeout(t); t = setTimeout(async () => {
    const q = qi.value.trim(); if (!q) return qpop(false);
    $('#qpop').innerHTML = '<div class="skel" style="height:56px;margin:6px"></div>'; qpop(true);
    await buildIndex(); if (qi.value.trim() !== q) return;
    const ord = Object.keys(TYPES); const rs = query(q, 9).sort((a, b) => ord.indexOf(a.e.type) - ord.indexOf(b.e.type)); sel = -1;
    $('#qpop').innerHTML = rs.length ? rs.map(r => `<div class="grp">${TYPES[r.e.type]}</div>${resultHTML(r, q)}`).join('') +`<a class="foot" href="#/ค้นหา?q=${encodeURIComponent(q)}">ดูผลลัพธ์ทั้งหมด →</a>`
      : `<div style="padding:18px;text-align:center;color:var(--muted)">ไม่พบ “${esc(q)}”</div>`;
    dedupeGroups();
  }, 140); });
  qi.addEventListener('keydown', e => {
    const its = $$('#qpop .item'); if (!its.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + its.length) % its.length; its.forEach((x, i) => x.style.background = i === sel ? 'var(--surface-2)' : ''); its[sel].scrollIntoView({ block: 'nearest' }); }
    if (e.key === 'Enter' && sel >= 0) { e.preventDefault(); its[sel].click(); qpop(false); qi.blur(); }
    if (e.key === 'Escape') { qpop(false); }
  });
  $('#qpop').addEventListener('click', e => { if (e.target.closest('a')) { qpop(false); qi.value = ''; } });
  document.addEventListener('keydown', e => { if (e.key === '/' && !e.target.closest('input,textarea,select') && getComputedStyle($('#qf')).display !== 'none') { e.preventDefault(); qi.focus(); } });
}
function dedupeGroups() { let last = ''; $$('#qpop .grp').forEach(g => { if (g.textContent === last) g.remove(); else last = g.textContent; }); }
function qpop(on) { $('#qpop').classList.toggle('on', on); $('#qi').setAttribute('aria-expanded', on); }

/* ------------------------------------------------------------------ meta / SEO */
function setMeta(t, d, image) {
  document.title = t ? `${t} | LOW CLASS UNIVERSE` : 'LOW CLASS UNIVERSE · สารานุกรมจักรวาล LCU';
  const set = (sel, attr, v) => { const el = document.head.querySelector(sel); if (el && v) el.setAttribute(attr, v); };
  const desc = d || 'สารานุกรมจักรวาล LOW CLASS UNIVERSE (LCU) — ตัวละคร กลุ่ม & องค์กร สถานที่ ไทม์ไลน์ และคลังนิยายออนไลน์';
  set('meta[name="description"]', 'content', desc); set('meta[property="og:description"]', 'content', desc);
  set('meta[property="og:title"]', 'content', document.title);
  set('meta[property="og:image"]', 'content', CONFIG.SITE_URL + (image || 'hero.webp'));
  set('link[rel="canonical"]', 'href', CONFIG.SITE_URL + location.hash);
}

/* ------------------------------------------------------------------ router */
const R = (p, qs) => {
  const D = S.D;
  let m;
  if (p === '/' || p === HOME) return ['home', renderHome(), ''];
  if (p === '/universe') return ['universe', renderUniverse(), 'Universe'];
  if (p === '/universe/timeline') return ['universe', renderTimeline(qs), 'ไทม์ไลน์'];
  if (p === '/universe/stories') return ['universe', renderStories(), 'ฐานข้อมูลเรื่อง'];
  if ((m = p.match(/^\/universe\/stories\/(L?[\d.]+)$/))) return ['universe', renderStory(m[1]), 'เรื่อง'];
  if (p === PATHS.chars || D.cats.includes(p)) return ['universe', renderChars(p === PATHS.chars ? '' : p, qs), p === PATHS.chars ? 'ตัวละคร' : title(p)];
  if (p === PATHS.groups) return ['universe', renderGroups(qs), 'กลุ่ม & องค์กร'];
  if (p === '/novels') return ['novels', renderLibrary(), 'คลังนิยาย'];
  if ((m = p.match(/^\/novels\/vol-(\d+)$/))) return ['novels', renderVolume(+m[1]), `Vol.${m[1]}`];
  if ((m = p.match(/^\/novels\/([^/]+)\/(\d+)$/))) return ['novels', renderReader(m[1], +m[2]), 'อ่านนิยาย'];
  if ((m = p.match(/^\/novels\/([^/]+)$/))) return ['novels', renderNovel(m[1]), 'นิยาย'];
  if (p === '/lustzone' || p.startsWith('/lustzone/')) return ['lustzone', renderLustzone(p), 'LUSTZONE'];
  if (p === '/about') return ['about', renderAbout(), 'About LCU'];
  if (p === '/stats') return ['novels', renderStats(), 'สถิติการอ่าน'];
  if (p === '/ค้นหา') { const q = qs.get('q') || ''; return ['', renderSearch(q, qs.get('type') || ''), q ? `ค้นหา “${q}”` : 'ค้นหา']; }
  if (D.pages[p]) { const c = X.charBy.get(p); return ['universe', c ? renderCharacter(p, c) : renderPage(p), title(p), firstImg(p)?.[0]]; }
  return ['', renderNotFound(), 'ไม่พบหน้า'];
};
let lastPath = null;
async function route() {
  let h; try { h = decodeURIComponent(location.hash.slice(1) || '/'); } catch { h = location.hash.slice(1) || '/'; }
  const [p0, q0 = ''] = h.split('?'); const p = p0.replace(/\/+$/, '') || '/'; const qs = new URLSearchParams(q0);
  document.body.classList.remove('reading');
  $('#qpop')?.classList.remove('on');
  let sec = '', t = '', image = null, res;
  try { [sec, res, t, image] = R(p, qs); setMeta(t, null, image); await res; }
  catch (err) {
    console.error(err);
    $('#app').innerHTML = `<div class="wrap"><section class="section"><div class="empty"><div class="ico">!</div><b>เกิดข้อผิดพลาดในการแสดงหน้านี้</b><p>ลองรีเฟรชอีกครั้ง</p><button class="btn ghost sm" style="margin-top:14px" onclick="location.reload()">รีเฟรช</button></div></section></div>`;
  }
  $$('.nav [data-k]').forEach(a => { if (a.dataset.k === sec) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  $$('#app a[href^="http"]').forEach(x => { x.target = '_blank'; x.rel = 'noopener'; });
  $$('#app img:not([alt])').forEach(x => x.alt = '');
  if (p !== lastPath) { scrollTo(0, 0); lastPath = p; $('#app').focus({ preventScroll: true }); }
  observeReveal();
  if (window.gtag) window.gtag('event', 'page_view', { page_path: '/' + p, page_title: document.title });
}

/* ------------------------------------------------------------------ global behaviours */
let io = null;
function observeReveal() {
  const els = $$('.reveal:not(.in)'); if (!els.length) return;
  if (!('IntersectionObserver' in window)) return els.forEach(e => e.classList.add('in'));
  io ||= new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
  els.forEach(e => io.observe(e));
}
function wireGlobal() {
  const lb = $('#lb');
  document.addEventListener('click', e => {
    const z = e.target.closest('img.z,.gal img,.pic img,.portrait img');
    if (z && !z.closest('a')) { lb.querySelector('img').src = z.currentSrc || z.src; lb.querySelector('img').alt = z.alt; lb.classList.add('on'); lb.querySelector('button').focus(); }
  });
  lb.addEventListener('click', e => { if (e.target === lb || e.target.closest('button')) lb.classList.remove('on'); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') lb.classList.remove('on'); });
  const tb = $('#totop');
  addEventListener('scroll', () => tb.classList.toggle('on', scrollY > 900), { passive: true });
  tb.onclick = () => scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}

/* ------------------------------------------------------------------ boot */
async function boot() {
  try { await loadCore(); }
  catch (err) {
    console.error(err);
    $('#app').innerHTML = `<div class="boot"><div><p>โหลดข้อมูลจักรวาลไม่สำเร็จ</p><button class="btn ghost sm" style="margin-top:16px" onclick="location.reload()">ลองใหม่</button></div></div>`;
    return;
  }
  $('#hdr').innerHTML = headerHTML(); $('#drawer').innerHTML = drawerHTML(); $('#ftr').innerHTML = footerHTML();
  wireHeader(); wireGlobal();
  addEventListener('hashchange', route);
  route();
}
boot();
