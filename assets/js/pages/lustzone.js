// LUSTZONE: age gate + section pages.
// IMPORTANT: this static site holds NO adult chapter content. The gate here is a self-declaration
// screen only; real access control for adult chapters must be enforced server-side (see /worker).
import { S, $, esc, ageOK, setAge, loadLustTimeline, storyHref, storyYears, go, store } from '../core.js';
import { pageHead, crumbs, secHead, empty } from '../ui.js';
import { statBlock, obtainAgeToken, clearAgeToken, apiBase, authHeader, track } from '../stats.js';
import { renderReader } from './novels.js';
import { ICON } from '../ui.js';

let open = null;
export function requireAge() {
  if (ageOK()) return Promise.resolve(true);
  if (open) return open;
  open = new Promise(res => {
    const prev = document.activeElement;
    const g = document.createElement('div');
    g.className = 'gate'; g.setAttribute('role', 'dialog'); g.setAttribute('aria-modal', 'true'); g.setAttribute('aria-labelledby', 'gate-t');
    g.innerHTML = `<div class="box">
      <h2 id="gate-t">LUSTZONE</h2><div class="sub">ADULT CONTENT WARNING</div>
      <p>This section contains adult-oriented fictional content intended exclusively for individuals aged 18 and above.</p>
      <p style="margin-top:8px">ส่วนนี้มีเนื้อหานิยายสำหรับผู้ใหญ่ เฉพาะผู้ที่มีอายุ 18 ปีขึ้นไปเท่านั้น</p>
      <div class="q">Are you at least 18 years old?</div>
      <div class="acts"><button class="btn yes" data-a="1">YES, I AM 18+</button><button class="btn ghost" data-a="0">NO, EXIT</button></div>
      <small>การยืนยันนี้เป็นการยืนยันอายุด้วยตนเอง และจะหมดอายุภายในระยะเวลาที่กำหนด</small></div>`;
    document.body.appendChild(g); document.body.style.overflow = 'hidden';
    const btns = g.querySelectorAll('button'); btns[0].focus();
    const done = ok => { g.remove(); document.body.style.overflow = ''; open = null; prev?.focus?.(); if (ok) { setAge(true); obtainAgeToken().finally(() => res(true)); } else { setAge(false); clearAgeToken(); res(false); if (location.hash.startsWith('#/lustzone') || /#\/universe\/stories\/L/.test(location.hash)) go('/'); } };
    g.addEventListener('click', e => { const b = e.target.closest('button'); if (b) done(b.dataset.a === '1'); });
    g.addEventListener('keydown', e => {
      if (e.key === 'Escape') done(false);
      if (e.key === 'Tab') { e.preventDefault(); (document.activeElement === btns[0] ? btns[1] : btns[0]).focus(); }
    });
  });
  return open;
}

export function drip() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const g = document.createElement('div'); g.className = 'drip'; const n = Math.max(10, Math.round(innerWidth / 70)); let h = '';
  for (let i = 0; i < n; i++) { const w = 14 + Math.random() * 34, l = (i + Math.random() * .6) / n * 100; h += `<i style="left:${l}%;width:${w}px;--h:${40 + Math.random() * 80}vh;--t:${(0.9 + Math.random() * 1.1).toFixed(2)}s;--dl:${(Math.random() * .5).toFixed(2)}s"></i>`; }
  g.innerHTML = h; document.body.appendChild(g); setTimeout(() => g.remove(), 3000);
}

// ---------------------------------------------------------------- protected API helpers
async function lzGet(path) {
  await obtainAgeToken();
  let r = await fetch(apiBase() + path, { headers: authHeader() });
  if (r.status === 403) { clearAgeToken(); await obtainAgeToken(); r = await fetch(apiBase() + path, { headers: authHeader() }); }
  if (!r.ok) throw new Error('lz ' + r.status);
  return r.json();
}
const head = (crumbsList, sub = '', extra = '') => pageHead({ crumbsHTML: crumbs(crumbsList), eyebrow: '18+ · Adult Fiction', h1: crumbsList[crumbsList.length - 1][0], sub, extra });
const chLabel = c => /^(ตอน|บท)/.test(c.title || '') ? c.title : `ตอนที่ ${c.n}${c.title ? ' · ' + c.title : ''}`;

// #/lustzone, #/lustzone/<novelId>, #/lustzone/<novelId>/<n>
export async function renderLustzone(p = '/lustzone') {
  const app = $('#app');
  const [, , id, num] = p.split('/');
  app.innerHTML = `<div class="lz-theme">${pageHead({ crumbsHTML: crumbs([['หน้าแรก', '/'], ['LUSTZONE', null]]), eyebrow: '18+ · Adult Fiction', h1: 'LUSTZONE' })}<div class="wrap"><div class="skel" style="height:220px;margin-top:32px"></div></div></div>`;
  if (!(await requireAge())) return;
  if (id && num && apiBase()) return renderLzReader(id, +num);
  if (id && apiBase()) return renderLzNovel(id);
  if (!id) drip();
  let stories = [];
  try { await loadLustTimeline(); stories = S.TL.stories.filter(s => s.lust); } catch { /* timeline optional */ }
  let lib = null, err = '';
  if (apiBase()) { try { lib = (await lzGet('/v1/lz/novels')).novels; } catch { err = 'เชื่อมต่อเซิร์ฟเวอร์ LUSTZONE ไม่สำเร็จ ลองรีเฟรชอีกครั้ง'; } }
  const prog = store.get('lcu:progress', {});
  const libHTML = lib && lib.length ? `<div class="grid">${lib.map(n => { const pr = prog['lz:' + n.id]; return `<a class="card nv-card" href="#/lustzone/${esc(n.id)}"><div class="art">${n.cover ? `<img src="${n.cover}" alt="${esc(n.title)}" loading="lazy">` : ''}</div><div class="tagline"><span class="badge lz">18+</span></div><div class="cap"><div class="nm">${esc(n.title)}</div><div class="sb">${n.chapters} ตอน${pr ? ' · อ่านถึงตอน ' + pr.n : ''}</div></div></a>`; }).join('')}</div>`
    : err ? empty(err, '', '!') : empty('ยังไม่มีนิยายที่เผยแพร่ในส่วนนี้', '<p>เนื้อหาตอนของ LUSTZONE เปิดผ่านระบบที่ตรวจสิทธิ์ฝั่งเซิร์ฟเวอร์เท่านั้น</p>', '18+');
  app.innerHTML = `<div class="lz-theme">${head([['หน้าแรก', '/'], ['LUSTZONE', null]], 'โซนนิยายสำหรับผู้ใหญ่ของจักรวาล LCU แยกจากคลังนิยายทั่วไปอย่างชัดเจน', `<div class="chips" style="margin-top:14px"><button class="chip" id="lzout">ออกจาก LUSTZONE / ยกเลิกการยืนยันอายุ</button></div>`)}
  <div class="wrap">
    <section class="section">${secHead('คลังนิยาย LUSTZONE')}${libHTML}</section>
    ${stories.length ? `<section class="section">${secHead('เรื่องใน Lust Zone (ไทม์ไลน์)', 'ไทม์ไลน์', '/universe/timeline?v=story&lz=1')}
      <div class="grid lg">${stories.map(s => `<a class="card text" href="#${storyHref(s)}" style="border-left:3px solid var(--lust-accent)"><span class="eyebrow">[L${esc(s.no)}]</span><div class="h3" style="margin-top:8px;font-size:18px">${esc(s.name)}</div><p>${storyYears(s) ? 'พ.ศ. ' + storyYears(s) + ' · ' : ''}${s.count} เหตุการณ์ (สรุปเฉพาะเนื้อเรื่อง)</p></a>`).join('')}</div></section>` : ''}
    <section class="section">${secHead('สถิติ LUSTZONE')}${statBlock('lustzone')}</section>
  </div></div>`;
  $('#lzout').onclick = () => { setAge(false); clearAgeToken(); go('/'); };
}

async function renderLzNovel(id) {
  const app = $('#app');
  let n; try { n = await lzGet('/v1/lz/novel?id=' + encodeURIComponent(id)); } catch { n = null; }
  if (!n) { app.innerHTML = `<div class="lz-theme">${head([['หน้าแรก', '/'], ['LUSTZONE', '/lustzone'], ['ไม่พบนิยาย', null]])}<div class="wrap"><section class="section">${empty('ไม่พบนิยายเรื่องนี้', '<a class="btn ghost sm" href="#/lustzone" style="margin-top:14px">กลับ LUSTZONE</a>')}</section></div></div>`; return; }
  const pr = store.get('lcu:progress', {})['lz:' + id]; const chs = n.chapters || [];
  track({ type: 'novel_view', novel: id });
  app.innerHTML = `<div class="lz-theme">${head([['หน้าแรก', '/'], ['LUSTZONE', '/lustzone'], [n.title, null]], '', `<div class="chips" style="margin-top:14px"><span class="badge lz">18+</span><span class="chip">${chs.length} ตอน</span></div>${chs.length ? `<div style="margin-top:20px"><a class="btn" href="#/lustzone/${esc(id)}/${pr ? pr.n : chs[0].n}">${pr ? 'อ่านต่อ ตอนที่ ' + pr.n : 'เริ่มอ่าน'}</a></div>` : ''}`)}
  <div class="wrap"><section class="section">${secHead('สารบัญ')}<div class="toc-list">${chs.map(c => `<a href="#/lustzone/${esc(id)}/${c.n}" class="${pr && c.n < pr.n ? 'read' : ''} ${pr && c.n === pr.n ? 'cur' : ''}"><span>${esc(chLabel(c))}</span><span class="muted" style="font-size:13px">~${c.minutes} นาที</span></a>`).join('')}</div></section></div></div>`;
}

let lzMetaCache = {};
function renderLzReader(id, num) {
  return renderReader(id, num, {
    base: '/lustzone/' + id, key: 'lz:' + id,
    load: async n => {
      const meta = lzMetaCache[id] ||= await lzGet('/v1/lz/novel?id=' + encodeURIComponent(id));
      const ch = await lzGet(`/v1/lz/chapter?novel=${encodeURIComponent(id)}&n=${n}`);
      return { n: { id, title: meta.title }, meta: { chapters: meta.chapters }, ch };
    },
  });
}
