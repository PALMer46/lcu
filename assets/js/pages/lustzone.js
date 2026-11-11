// LUSTZONE: age gate + section pages.
// IMPORTANT: this static site holds NO adult chapter content. The gate here is a self-declaration
// screen only; real access control for adult chapters must be enforced server-side (see /worker).
import { S, $, esc, ageOK, setAge, loadLustTimeline, storyHref, storyYears, go } from '../core.js';
import { pageHead, crumbs, secHead, empty } from '../ui.js';
import { statBlock, obtainAgeToken, clearAgeToken } from '../stats.js';

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

export async function renderLustzone() {
  const app = $('#app');
  app.innerHTML = `<div class="lz-theme">${pageHead({ crumbsHTML: crumbs([['หน้าแรก', '/'], ['LUSTZONE', null]]), eyebrow: '18+ · Adult Fiction', h1: 'LUSTZONE' })}<div class="wrap"><div class="skel" style="height:220px;margin-top:32px"></div></div></div>`;
  if (!(await requireAge())) return;
  drip();
  let stories = [];
  try { await loadLustTimeline(); stories = S.TL.stories.filter(s => s.lust); } catch { /* timeline optional */ }
  app.innerHTML = `<div class="lz-theme">${pageHead({ crumbsHTML: crumbs([['หน้าแรก', '/'], ['LUSTZONE', null]]), eyebrow: '18+ · Adult Fiction', h1: 'LUSTZONE',
    sub: 'โซนนิยายสำหรับผู้ใหญ่ของจักรวาล LCU แยกจากคลังนิยายทั่วไปอย่างชัดเจน', extra: `<div class="chips" style="margin-top:14px"><button class="chip" id="lzout">ออกจาก LUSTZONE / ยกเลิกการยืนยันอายุ</button></div>` })}
  <div class="wrap">
    <section class="section">${secHead('คลังนิยาย LUSTZONE')}
      ${empty('ยังไม่มีนิยายที่เผยแพร่ในส่วนนี้', '<p>เนื้อหาตอนของ LUSTZONE จะเปิดผ่านระบบที่ตรวจสิทธิ์ฝั่งเซิร์ฟเวอร์เท่านั้น<br>ไม่มีการเก็บเนื้อหานิยาย 18+ ไว้บนเว็บไซต์สาธารณะนี้</p>', '18+')}</section>
    ${stories.length ? `<section class="section">${secHead('เรื่องใน Lust Zone (ไทม์ไลน์)', 'ไทม์ไลน์', '/universe/timeline?v=story&lz=1')}
      <div class="grid lg">${stories.map(s => `<a class="card text" href="#${storyHref(s)}" style="border-left:3px solid var(--lust-accent)"><span class="eyebrow">[L${esc(s.no)}]</span><div class="h3" style="margin-top:8px;font-size:18px">${esc(s.name)}</div><p>${storyYears(s) ? 'พ.ศ. ' + storyYears(s) + ' · ' : ''}${s.count} เหตุการณ์ (สรุปเฉพาะเนื้อเรื่อง)</p></a>`).join('')}</div></section>` : ''}
    <section class="section">${secHead('สถิติ LUSTZONE')}${statBlock('lustzone')}</section>
  </div></div>`;
  $('#lzout').onclick = () => { setAge(false); clearAgeToken(); go('/'); };
}
