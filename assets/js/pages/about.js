// ABOUT LCU: renders every section of the original home page (nothing dropped).
import { S, $, HOME } from '../core.js';
import { pageHead, crumbs, secHTML, proseHTML, secHead } from '../ui.js';

export function renderAbout() {
  const secs = S.D.pages[HOME].secs;
  const intro = secs.find(x => x.some(b => b.t === 'h' && /สารานุกรม/.test(b.x))) || [];
  const rest = secs.filter(s => s !== intro);
  $('#app').innerHTML = pageHead({ crumbsHTML: crumbs([['หน้าแรก', '/'], ['About LCU', null]]), eyebrow: 'About', h1: 'เกี่ยวกับ LOW CLASS UNIVERSE' }) + `<div class="wrap">
    <section class="section"><div class="prose">${proseHTML(intro)}</div></section>
    <section class="section">${rest.map(s => secHTML(s, 'LOW CLASS UNIVERSE')).join('')}</section>
    <section class="section">${secHead('ความเป็นส่วนตัว')}<div class="prose"><p>เว็บไซต์นี้ใช้ Google Analytics และ (เมื่อเปิดใช้งาน) ระบบนับยอดอ่านของ LCU ซึ่งเก็บรหัสผู้อ่านแบบสุ่มที่ไม่ระบุตัวตนไว้ในเบราว์เซอร์ของคุณ เพื่อนับยอดอ่านและจำตอนที่อ่านค้างไว้ ไม่มีการเก็บชื่อ อีเมล หรือใช้การระบุตัวตนอุปกรณ์ (fingerprinting) — ล้างข้อมูลได้ทุกเมื่อด้วยการลบข้อมูลเว็บไซต์ในเบราว์เซอร์</p></div></section>
  </div>`;
}
