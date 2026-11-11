// Reading analytics client. Sends events to the Cloudflare Worker and renders REAL statistics only.
// Nothing is shown as a number unless it came from the backend (or is an exact count of local data).
import { CONFIG } from './config.js';
import { S, $, $$, esc, fmt, store, loadNovels } from './core.js';
import { pageHead, crumbs, secHead } from './ui.js';

const API = CONFIG.API_BASE.replace(/\/$/, '');
export const statsEnabled = () => !!API;

export function readerId() {
  let id = store.get('lcu:rid');
  if (!id) { id = (crypto.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2)); store.set('lcu:rid', id); }
  return id;
}
function sessionId() {
  try { let s = sessionStorage.getItem('lcu:sid'); if (!s) { s = crypto.randomUUID?.() || String(Math.random()).slice(2); sessionStorage.setItem('lcu:sid', s); } return s; } catch { return 'nosession'; }
}
// event: { type: 'chapter_view'|'novel_view', novel, chapter }
export function track(ev) {
  if (!API) return;
  const body = JSON.stringify({ ...ev, reader: readerId(), session: sessionId() });
  try { fetch(API + '/v1/events', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => {}); } catch { /* never break reading */ }
}

// LUSTZONE: signed, expiring token issued by the Worker after the 18+ confirmation (checked server-side)
export async function obtainAgeToken() {
  if (!API) return;
  try { const r = await fetch(API + '/v1/age', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"confirm":true}' });
    if (r.ok) { const j = await r.json(); store.set('lcu:lztok', { t: j.token, exp: j.exp }); } } catch { /* offline */ }
}
export const clearAgeToken = () => store.del('lcu:lztok');
function authHeader() { const t = store.get('lcu:lztok'); return t && t.exp > Date.now() ? { authorization: 'Bearer ' + t.t } : {}; }
async function fetchStats(scope) {
  const r = await fetch(`${API}/v1/stats?scope=${encodeURIComponent(scope)}`, { headers: authHeader() });
  if (!r.ok) throw new Error('stats ' + r.status);
  return r.json();
}

const LABELS = {
  views: ['Total Views', 'การเข้าอ่านที่นับได้'], readers: ['Unique Readers', 'ค่าประมาณจากรหัสผู้อ่านนิรนาม'],
  novels: ['Total Novels', 'นิยายที่เผยแพร่'], chapters: ['Total Chapters', 'ตอนที่เผยแพร่'],
};
// Placeholder that hydrates itself after render
export function statBlock(scope, keys = ['views', 'readers', 'novels', 'chapters']) {
  const id = 'st' + Math.random().toString(36).slice(2, 8);
  queueMicrotask(() => hydrate(id, scope, keys));
  return `<div id="${id}" class="kpis">${keys.map(k => `<div class="kpi"><span>${LABELS[k][0]}</span><b class="skel" style="height:34px;width:60%"></b></div>`).join('')}</div>`;
}
async function hydrate(id, scope, keys) {
  const el = document.getElementById(id); if (!el) return;
  const nv = await loadNovels();
  const pub = (nv.novels || []).filter(n => n.status !== 'draft' && (scope === 'lustzone' ? n.adult : !n.adult) && (scope.startsWith('vol-') ? n.volume === scope : true));
  const local = { novels: pub.length, chapters: pub.reduce((a, n) => a + (n.chapters || 0), 0) };
  let remote = null, err = '';
  if (API) { try { remote = await fetchStats(scope); } catch { err = 'โหลดสถิติจากเซิร์ฟเวอร์ไม่สำเร็จ'; } }
  if (!document.getElementById(id)) return;
  el.innerHTML = keys.map(k => {
    const v = remote && k in remote ? remote[k] : (k in local ? local[k] : null);
    return `<div class="kpi"><span>${LABELS[k][0]}</span>${v == null ? `<b class="na">${API ? '—' : 'ยังไม่เปิดระบบ'}</b>` : `<b>${fmt(v)}</b>`}<small>${LABELS[k][1]}</small></div>`;
  }).join('') + (!API ? `<div class="notice" style="grid-column:1/-1">ระบบนับยอดอ่านยังไม่ได้เชื่อมต่อ ยอดวิวและผู้อ่านจะเริ่มนับเมื่อเปิดใช้งานเซิร์ฟเวอร์สถิติ (ไม่มีการแสดงตัวเลขสมมติ)</div>` : err ? `<div class="notice warn" style="grid-column:1/-1">${err}</div>` : '');
}

export function renderStats() {
  $('#app').innerHTML = pageHead({ crumbsHTML: crumbs([['หน้าแรก', '/'], ['สถิติ LCU', null]]), eyebrow: 'Global Statistics', h1: 'สถิติการอ่าน LCU',
    sub: 'ตัวเลขทั้งหมดมาจากระบบเก็บสถิติจริง หากยังไม่มีข้อมูลจะแสดงเป็นศูนย์หรือสถานะว่าง' }) + `<div class="wrap">
    <section class="section">${secHead('ภาพรวมทั้งจักรวาล')}${statBlock('global')}</section>
    <section class="section">${secHead('LCU Vol.1')}${statBlock('vol-1')}</section>
    <section class="section">${secHead('LCU Vol.2')}${statBlock('vol-2')}</section>
    <section class="section">${secHead('LCU Vol.3')}${statBlock('vol-3')}</section>
    <section class="section">${secHead('LUSTZONE')}${statBlock('lustzone', ['views', 'readers', 'novels', 'chapters'])}</section>
    <section class="section"><div class="notice"><div><b style="color:#fff">นิยามตัวชี้วัด</b><br>
      <b>Views</b> = การเปิดอ่านตอนที่ผ่านการตรวจสอบ (เปิดซ้ำตอนเดิมภายใน 30 นาทีนับครั้งเดียว) ·
      <b>Unique Readers</b> = จำนวนรหัสผู้อ่านนิรนามที่ไม่ซ้ำกัน — เป็น<u>ค่าประมาณ</u> ไม่ใช่จำนวนคนจริงที่ยืนยันตัวตน (ผู้อ่านคนเดียวที่ใช้หลายอุปกรณ์จะนับหลายครั้ง) ·
      <b>Volume Views</b> = ผลรวมยอดอ่านของนิยายใน Volume นั้น · ไม่มีการใช้ device fingerprinting</div></div></section>
  </div>`;
}
