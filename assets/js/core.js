// Core: data loading, helpers and derived indexes shared by every page.
import { CONFIG } from './config.js';

export const S = { D: null, TL: null, NV: null };   // data.json, timeline, novels index
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const strip = s => String(s || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
// Thai-aware normalisation: lower-case, NFC, drop Thai tone/vowel marks and whitespace so
// "อาปัส" matches "อาปส" (Google Sites slugs) and minor spelling differences.
const DIA = /[ัิ-ฺ็-๎]/g;
export const norm = s => strip(s).toLowerCase().normalize('NFC').replace(DIA, '').replace(/[\s​]+/g, '');
export const emoSplit = t => { const m = String(t).match(/^(\p{Extended_Pictographic}[️‍\p{Extended_Pictographic}]*)\s*(.*)$/u); return m ? [m[1], m[2]] : ['', t]; };
export const go = p => { location.hash = '#' + p; };
export const isExt = h => /^https?:/.test(h || '');
export const fmt = n => Number(n || 0).toLocaleString('th-TH');
export const be = y => y + 543;

// safe storage (private mode / blocked storage must never break the site)
export const store = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

export const HOME = '/หนาแรก';
export const PATHS = {
  chars: '/ตวละคร', groups: '/กลม-องคกร', worlds: '/ตางโลก', tech: '/เทคโนโลย-อาวธ', plan: '/เสนเวลา-เหตการณ',
  himmapan: '/ตางโลก/โลกหมพานต', heavenHell: '/ตางโลก/สวรรค-นรก',
};
const RENAME = { [PATHS.plan]: 'แผนเรื่องใหม่' };
export const title = p => RENAME[p] || S.D.pages[p]?.title || decodeURIComponent(p.split('/').pop());

export function img(src, { cls = '', alt = '', eager = false, sizes = '' } = {}) {
  if (!src) return '';
  return `<img src="${src[0]}" width="${src[1]}" height="${src[2]}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" alt="${esc(alt)}"${cls ? ` class="${cls}"` : ''}${sizes ? ` sizes="${sizes}"` : ''}>`;
}

/* ------------------------------------------------------------------ loading */
async function getJSON(url) {
  const r = await fetch(url, { cache: 'default' });
  if (!r.ok) throw new Error(url + ' → HTTP ' + r.status);
  return r.json();
}
export async function loadCore() {
  const [D, TL] = await Promise.all([getJSON('data.json'), getJSON('timeline.json').catch(() => null)]);
  S.D = D; S.TL = TL ? parseTimeline(TL) : null;
  derive();
}
let nvPromise = null;
export function loadNovels() {
  nvPromise ||= getJSON('novels/index.json').catch(() => ({ novels: [] })).then(x => (S.NV = x));
  return nvPromise;
}
let lzPromise = null;
export function loadLustTimeline() {
  lzPromise ||= getJSON('timeline-lz.json').then(x => { addTimelineLines(x.lines); return S.TL; });
  return lzPromise;
}

/* ------------------------------------------------------------------ derived */
export const X = { charBy: new Map(), back: new Map(), cardImg: new Map(), groupMembers: new Map() };

function derive() {
  const { D } = S;
  X.charBy = new Map(D.chars.map(c => [c.p, c]));
  // backlinks: one pass over every page (was JSON.stringify of every page on every view)
  X.back = new Map();
  for (const [k, v] of Object.entries(D.pages)) {
    const seen = new Set();
    for (const s of v.secs) for (const b of s) {
      const hs = [];
      if (b.href?.startsWith('#/')) hs.push(b.href.slice(1));
      for (const x of [b.x || '', ...(b.items || [])]) for (const m of x.matchAll(/href="#(\/[^"]*)"/g)) hs.push(m[1]);
      for (const h of hs) if (h !== k && !seen.has(h)) { seen.add(h); (X.back.get(h) || X.back.set(h, []).get(h)).push(k); }
    }
  }
  // card image of each linked page, as shown on listing pages
  X.cardImg = new Map();
  for (const v of Object.values(D.pages)) for (const s of v.secs) for (const b of s)
    if (b.t === 'img' && b.href?.startsWith('#/') && !X.cardImg.has(b.href.slice(1))) X.cardImg.set(b.href.slice(1), b.src);
  X.groupMembers = new Map(D.groups.map(g => [g, D.chars.filter(c => c.g.includes(g))]));
  if (S.TL) linkStories();
}
export const firstImg = p => X.cardImg.get(p) || S.D.pages[p]?.secs.flat().find(b => b.t === 'img')?.src || null;
export const pageText = p => S.D.pages[p].secs.flat().map(b => strip(b.x || '') + ' ' + (b.items || []).map(strip).join(' ')).join(' ').replace(/\s+/g, ' ').trim();

/* ------------------------------------------------------------------ timeline */
// Port of the original lcu-timeline parser (same rules, same data, no text changes).
const MON = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
export { MON };
const monRe = new RegExp('^(\\d{1,2}) (' + MON.join('|') + ')(?: พ\\.ศ\\. (\\d{4}) \\(ค\\.ศ\\. (\\d{4})\\))? - (.*)$');
const yrRe = /^(ก่อน)?ปี พ\.ศ\. (\d{4}) \(ค\.ศ\. (\d{4})\)(?:\s*-\s*(.*))?$/;
let tlState = null;
function parseTimeline(T) {
  const TL = { series: T.series, volumes: T.volumes || [], stories: [], events: [], shadow: T.shadowStory, lustLoaded: false };
  tlState = { TL, cur: null, yr: null, before: false, seq: 0, mainN: 0 };
  addTimelineLines(T.lines);
  return TL;
}
function addTimelineLines(lines) {
  const st = tlState, TL = st.TL;
  const add = (no, y, mo, d, t, b) => TL.events.push({ st: no, y, mo: b ? -1 : mo, d, t, i: st.seq++ });
  for (const raw of lines) {
    const l = raw.replace(/ /g, ' ').trim(); if (!l) continue;
    if (l.startsWith('## ')) {
      const h = l.slice(3).trim(), lm = h.match(/^\[L([\d.]+)\]\s*(.*)$/);
      if (lm) { const p = lm[1].split('.').map(Number); st.cur = { no: lm[1], name: lm[2], lust: true, ord: p[0] + 0.5 + (p.length > 2 ? p[1] / 1000 : 0) }; TL.lustLoaded = true; }
      else { st.mainN++; st.cur = { no: st.mainN, name: h, ord: st.mainN }; }
      TL.stories.push(st.cur); st.yr = null; continue;
    }
    const sn = st.cur ? st.cur.no : TL.shadow;
    let m = l.match(yrRe);
    if (m) { st.yr = +m[3]; st.before = !!m[1]; if (m[4]) add(sn, st.yr, 0, 0, m[4], st.before); continue; }
    m = l.match(monRe);
    if (m) { add(sn, m[4] ? +m[4] : st.yr, MON.indexOf(m[2]) + 1, +m[1], m[5], false); continue; }
    add(sn, st.yr, 0, 0, l.replace(/^[-•]\s*/, ''), st.before);
  }
  for (const s of TL.stories) {
    s.series = s.lust ? TL.series.find(x => x.k === 'lust') : (TL.series.find(x => x.s.includes(s.no)) || TL.series[0]);
    const ev = TL.events.filter(e => e.st === s.no);
    const ys = [...new Set(ev.map(e => e.y).filter(Boolean))].sort((a, b) => a - b);
    s.years = ys; s.count = ev.length;
    s.vol = s.lust ? null : [...TL.volumes].reverse().find(v => s.no >= v.from)?.name || null;
  }
  if (S.D) linkStories();
}
export const storyBy = no => S.TL?.stories.find(s => String(s.no) === String(no));
export const storyYears = s => s.years.length ? (s.years.length > 1 ? `${be(s.years[0])}–${be(s.years[s.years.length - 1])}` : `${be(s.years[0])}`) : '';
export const storyHref = s => `/universe/stories/${s.lust ? 'L' + s.no : s.no}`;

// Characters ↔ stories: uses the "มีบทบาทในเรื่อง" lists that already exist on character pages.
function linkStories() {
  const TL = S.TL; if (!TL) return;
  const idx = TL.stories.map(s => ({ s, n: norm(s.name) }));
  for (const s of TL.stories) s.chars = [];
  for (const c of S.D.chars) {
    c.stories = [];
    for (const t of appearances(c.p)) {
      const nt = norm(t);
      const hit = idx.filter(x => x.n.length > 3 && (nt.includes(x.n) || x.n.includes(nt) && nt.length > 6)).sort((a, b) => b.n.length - a.n.length)[0];
      if (hit && !c.stories.includes(hit.s)) { c.stories.push(hit.s); hit.s.chars.push(c); }
    }
  }
}
// plain-text list items following a "มีบทบาทในเรื่อง" label on a character page
export function appearances(p) {
  const out = []; let on = false;
  for (const s of S.D.pages[p]?.secs || []) for (const b of s) {
    if (b.t === 'p') on = /^มีบทบาทในเรื่อง/.test(strip(b.x).trim());
    else if (b.t === 'list' && on) out.push(...b.items.map(i => strip(i).trim()).filter(Boolean));
    else if (b.t !== 'list') on = false;
  }
  return out;
}

// Names that can be linked automatically inside timeline text (long enough to be unambiguous in Thai).
let nameRe = null, nameMap = null;
export function charNameLinker() {
  if (nameRe !== null) return { nameRe, nameMap };
  nameMap = new Map();
  for (const c of S.D.chars) {
    const base = c.n.split(/\s*[(（]/)[0].trim();
    for (const n of new Set([c.n, base])) {
      const ok = /[฀-๿]/.test(n) ? [...n].length >= 5 : n.length >= 4;
      if (ok && !nameMap.has(n)) nameMap.set(n, c.p);
    }
  }
  const keys = [...nameMap.keys()].sort((a, b) => b.length - a.length).map(k => esc(k).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  nameRe = keys.length ? new RegExp(keys.join('|'), 'g') : false;
  return { nameRe, nameMap };
}

/* ------------------------------------------------------------------ volumes (from the original home page) */
const PLATFORM = { 'novel.dek-d.com': 'Dek-D', 'www.readawrite.com': 'ReadAWrite', 'fictionlog.co': 'Fictionlog', 'www.kawebook.com': 'Kawebook', 'readeve.com': 'ReadEve' };
export function volumes() {
  const home = S.D.pages[HOME]; const vols = []; let cur = null;
  for (const s of home.secs) for (const b of s) {
    if (b.t === 'h') {
      const t = strip(b.x); const m = t.match(/LCU Vol\.(\d+)\s*(.*)$/);
      cur = m ? { n: +m[1], name: m[2].trim(), full: `LCU Vol.${m[1]} ${m[2].trim()}`, links: [], art: [] } : null;
      if (cur) vols.push(cur);
    } else if (cur && b.t === 'img') {
      if (b.href && isExt(b.href)) { const host = new URL(b.href).host; cur.links.push({ href: b.href, logo: b.src, name: PLATFORM[host] || host }); }
      else if (!b.href) cur.art.push(b.src);
    }
  }
  // story ranges from the timeline + planned titles from the "แผนเรื่องใหม่" page
  const plan = planEntries();
  for (const v of vols) {
    v.stories = S.TL ? S.TL.stories.filter(s => !s.lust && (s.vol || '').startsWith(`LCU Vol.${v.n}`)) : [];
    v.planned = plan.filter(p => p.vol === v.n);
  }
  return vols;
}
// "แผนการสร้าง" lines: "33. กลียุควิบัติ 🔲" under "LCU Vol.3 ..." and spin-off list items
export function planEntries() {
  const pg = S.D.pages[PATHS.plan]; const out = []; let vol = null, spin = false;
  for (const s of pg?.secs || []) for (const b of s) {
    if (b.t === 'p') {
      const t = strip(b.x).trim(); const vm = t.match(/^LCU Vol\.(\d+)/); const em = t.match(/^(\d+)\.\s*(.+?)\s*([🔲⌛✅])?$/u);
      if (vm) { vol = +vm[1]; spin = false; } else if (/^LCU Spin-Off/i.test(t)) { vol = null; spin = true; }
      else if (em) out.push({ no: +em[1], name: em[2], mark: em[3] || '', vol, spin: false });
    } else if (b.t === 'list' && spin) {
      for (const i of b.items) { const t = strip(i).replace(/ /g, ' ').trim(); const m = t.match(/^(.+?)\s*([🔲⌛✅])?$/u); out.push({ no: null, name: m[1], mark: m[2] || '', vol: null, spin: true }); }
    }
  }
  return out;
}
export const markLabel = m => ({ '✅': 'เสร็จแล้ว', '⌛': 'กำลังดำเนินการ', '🔲': 'ยังไม่เริ่ม' }[m] || '');

/* ------------------------------------------------------------------ age gate (LUSTZONE) */
export const ageOK = () => { const v = store.get('lcu:age18'); return !!(v && v.ok && v.exp > Date.now()); };
export const setAge = ok => ok ? store.set('lcu:age18', { ok: true, exp: Date.now() + CONFIG.AGE_TTL_DAYS * 864e5 }) : store.del('lcu:age18');
