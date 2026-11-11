// Timeline (integrated from the former lcu-timeline site) + Story / Volume database.
import { S, $, $$, esc, img, be, MON, storyBy, storyHref, storyYears, charNameLinker, planEntries, markLabel, volumes, ageOK, loadLustTimeline, loadNovels, fmt } from '../core.js';
import { ICON, pageHead, crumbs, secHead, charCard, empty } from '../ui.js';
import { requireAge, drip } from './lustzone.js';

const app = () => $('#app');
const dlab = e => e.mo > 0 ? e.d + ' ' + MON[e.mo - 1] : (e.mo < 0 ? 'ก่อนปี พ.ศ. ' + be(e.y) : '');
const sOrd = no => storyBy(no)?.ord || 0;
const key = (a, b) => (a.y || 0) - (b.y || 0) || a.mo - b.mo || a.d - b.d || sOrd(a.st) - sOrd(b.st) || a.i - b.i;
const sid = no => String(no).replace(/\./g, '_');

function evText(t, q) {
  let h = esc(t);
  if (q) { const r = new RegExp(esc(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'); return h.replace(r, x => `<mark>${x}</mark>`); }
  const { nameRe, nameMap } = charNameLinker();
  if (!nameRe) return h;
  const used = new Set();
  return h.replace(nameRe, m => { const p = nameMap.get(m.replace(/&amp;/g, '&')); if (!p || used.has(p)) return m; used.add(p); return `<a class="ch" href="#${p}">${m}</a>`; });
}

/* ================================================================ TIMELINE */
export function renderTimeline(qs) {
  const TL = S.TL;
  if (!TL) { app().innerHTML = pageHead({ h1: 'ไทม์ไลน์' }) + `<div class="wrap"><section class="section">${empty('โหลดข้อมูลไทม์ไลน์ไม่สำเร็จ', '<p>ลองรีเฟรชอีกครั้ง</p>')}</section></div>`; return; }
  const MAINK = TL.series.filter(s => s.k !== 'lust').map(s => s.k);
  const st = { view: qs.get('v') === 'story' ? 'story' : 'time', q: qs.get('q') || '', on: new Set(MAINK) };
  if (qs.get('s') && MAINK.includes(qs.get('s'))) st.on = new Set([qs.get('s')]);
  const series = s => s.series;

  app().innerHTML = pageHead({ crumbsHTML: crumbs([['หน้าแรก', '/'], ['Universe', '/universe'], ['ไทม์ไลน์', null]]), eyebrow: 'Universe Chronicle', h1: 'ไทม์ไลน์ LCU',
    sub: 'ลำดับเหตุการณ์ทั้งจักรวาล เรียงตามเวลาหรือตามเรื่อง <span class="badge red" style="margin-left:6px">มีสปอยล์</span>' }) + `
  <div class="tl-bar"><div class="wrap">
    <div class="row">
      <div class="seg" role="group" aria-label="มุมมอง"><button data-v="time">ตามเวลา</button><button data-v="story">ตามเรื่อง</button></div>
      <label class="field">${ICON.search}<span class="sr-only">ค้นหาในไทม์ไลน์</span><input id="tq" type="search" placeholder="ค้นหา เช่น CODE2, แคร์, ศิลา…" value="${esc(st.q)}"></label>
      <button class="lzt" id="lzt" aria-pressed="false">🔞 Lust Zone</button>
    </div>
    <div class="chips" id="tc"><button class="chip" data-k="*">ทั้งหมด</button>${TL.series.filter(s => s.k !== 'lust').map(s => `<button class="chip" data-k="${s.k}"><i style="--c:${s.c}"></i>${esc(s.n)}</button>`).join('')}</div>
  </div></div>
  <div class="wrap"><div id="tl" aria-live="polite"></div></div>`;

  const vis = e => { const s = storyBy(e.st); const k = s ? series(s).k : (TL.series.find(x => x.s.includes(e.st)) || TL.series[0]).k; return st.on.has(k) && (!st.q || (e.t + ' ' + (s?.name || '')).toLowerCase().includes(st.q.toLowerCase())); };
  const evHTML = (e, tag) => { const s = storyBy(e.st); const c = s ? series(s).c : TL.series[0].c; const d = dlab(e);
    return `<div class="tl-ev" style="--c:${c}">${d ? `<div class="dt ${e.mo > 0 ? '' : 'nd'}">${d}</div>` : ''}<div>${evText(e.t, st.q)}</div>${tag && s ? `<a class="st" href="#${storyHref(s)}"><i></i>${esc(String(s.no))}. ${esc(s.name)}</a>` : ''}</div>`; };

  function render() {
    let h = '';
    if (st.on.has('lust')) h += `<div class="lz-banner">🔞 Lust Zone เปิดอยู่ — มีเนื้อหาสำหรับผู้ใหญ่ (สรุปเฉพาะเนื้อเรื่อง) <button class="btn sm ghost" id="lzonly">${st.on.size === 1 ? 'แสดงรวมกับเรื่องหลัก' : 'ดูเฉพาะ Lust Zone'}</button></div>`;
    if (st.view === 'time') {
      const ev = TL.events.filter(vis).sort(key); let y = null; let b = '';
      for (const e of ev) { if (e.y !== y) { y = e.y; b += `<div class="tl-yr">${y ? `พ.ศ. ${be(y)}<small>ค.ศ. ${y}</small>` : 'ไม่ระบุปี'}</div>`; } b += evHTML(e, true); }
      h += b ? `<div class="tl">${b}</div>` : '';
    } else {
      let lastVol = null;
      for (const s of [...TL.stories].sort((a, b) => a.ord - b.ord)) {
        if (!st.on.has(series(s).k)) continue;
        const all = TL.events.filter(e => e.st === s.no).sort(key); const ev = all.filter(vis);
        if (st.q && !ev.length && !s.name.toLowerCase().includes(st.q.toLowerCase())) continue;
        if (s.vol && s.vol !== lastVol) { lastVol = s.vol; h += `<div class="tl-vol">${esc(s.vol)}</div>`; }
        let b = '', y = null; for (const e of (st.q ? ev : all)) { if (e.y !== y) { y = e.y; b += `<div class="sy">${y ? `พ.ศ. ${be(y)} (ค.ศ. ${y})` : ''}</div>`; } b += evHTML(e, false); }
        const yrs = storyYears(s);
        h += `<details class="story" id="s${sid(s.no)}" style="--c:${series(s).c}" ${st.q ? 'open' : ''}><summary><span class="no">${esc(String(s.no))}</span><span class="nm">${esc(s.name)}</span><span class="yrs">${yrs ? 'พ.ศ. ' + yrs : ''}</span></summary>
          <div class="sb"><div class="links"><a class="chip" href="#${storyHref(s)}">เปิดหน้าเรื่อง →</a>${(s.chars || []).slice(0, 8).map(c => `<a class="chip" href="#${c.p}">${esc(c.n)}</a>`).join('')}</div>${b || '<div class="tl-ev"><div class="dt nd">ยังไม่มีข้อมูล</div></div>'}</div></details>`;
      }
    }
    $('#tl').innerHTML = h || empty('ไม่พบเหตุการณ์ที่ตรงกับเงื่อนไข', '<p>ลองล้างคำค้นหรือเลือกซีรีส์อื่น</p>');
    $$('.seg button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === st.view));
    const allMain = MAINK.every(k => st.on.has(k));
    $$('#tc .chip').forEach(b => { if (b.dataset.k === '*') b.setAttribute('aria-pressed', allMain); else b.classList.toggle('off', !st.on.has(b.dataset.k)); });
    $('#lzt').setAttribute('aria-pressed', st.on.has('lust'));
    const lo = $('#lzonly'); if (lo) lo.onclick = () => { if (st.on.size === 1) MAINK.forEach(k => st.on.add(k)); else { st.on.clear(); st.on.add('lust'); } render(); };
    const p = new URLSearchParams(); if (st.view === 'story') p.set('v', 'story'); if (st.q) p.set('q', st.q);
    history.replaceState(null, '', '#/universe/timeline' + (p.toString() ? '?' + p : ''));
  }
  $('.seg').onclick = e => { const b = e.target.closest('button'); if (!b) return; st.view = b.dataset.v; render(); };
  $('#tc').onclick = e => { const b = e.target.closest('.chip'); if (!b) return; const k = b.dataset.k; const allMain = MAINK.every(x => st.on.has(x));
    if (k === '*') MAINK.forEach(x => st.on.add(x)); else if (allMain) { MAINK.forEach(x => st.on.delete(x)); st.on.add(k); } else st.on.has(k) ? st.on.delete(k) : st.on.add(k);
    if (![...st.on].some(x => x !== 'lust')) MAINK.forEach(x => st.on.add(x)); render(); };
  let t; $('#tq').oninput = e => { clearTimeout(t); t = setTimeout(() => { st.q = e.target.value.trim(); render(); }, 150); };
  $('#lzt').onclick = async () => {
    if (st.on.has('lust')) { st.on.delete('lust'); if (!st.on.size) MAINK.forEach(x => st.on.add(x)); return render(); }
    if (!(await requireAge())) return;
    $('#tl').innerHTML = '<div class="skel" style="height:200px;margin-top:20px"></div>';
    try { await loadLustTimeline(); st.on.add('lust'); drip(); } catch { /* keep main timeline */ }
    render();
  };
  if (qs.get('lz') === '1' && ageOK()) { loadLustTimeline().then(() => { st.on.add('lust'); render(); }); }
  render();
}

/* ================================================================ STORY / VOLUME DATABASE */
export function renderStories() {
  const TL = S.TL; const vols = volumes(); const plan = planEntries();
  const card = s => `<a class="card text" href="#${storyHref(s)}" style="border-left:3px solid ${s.series.c}">
    <span class="eyebrow" style="color:${s.series.c}">${esc(s.series.n)} · #${esc(String(s.no))}</span>
    <div class="h3" style="margin-top:8px;font-size:18px">${esc(s.name)}</div>
    <p>${storyYears(s) ? 'พ.ศ. ' + storyYears(s) + ' · ' : ''}${s.count} เหตุการณ์${s.chars?.length ? ' · ' + s.chars.length + ' ตัวละคร' : ''}</p></a>`;
  const planCard = p => `<div class="card text"><span class="eyebrow">${p.no ? '#' + p.no : 'Spin-Off'}</span><div class="h3" style="margin-top:8px;font-size:18px">${esc(p.name)}</div><p><span class="badge">${p.mark} ${markLabel(p.mark)}</span></p></div>`;
  app().innerHTML = pageHead({ crumbsHTML: crumbs([['หน้าแรก', '/'], ['Universe', '/universe'], ['ฐานข้อมูลเรื่อง', null]]), eyebrow: 'Story & Volume Database', h1: 'เรื่องราวในจักรวาล LCU', sub: 'ทุกเรื่องแยกตาม Volume เชื่อมกับไทม์ไลน์และตัวละครที่ปรากฏ' }) + `<div class="wrap">
  ${vols.map(v => `<section class="section">${secHead(esc(v.full), 'นิยาย Vol.' + v.n, '/novels/vol-' + v.n)}
    ${v.stories.length ? `<div class="grid lg">${v.stories.map(card).join('')}</div>` : ''}
    ${v.planned.length ? `<div class="grid lg" style="margin-top:12px">${v.planned.map(planCard).join('')}</div>` : ''}
    ${!v.stories.length && !v.planned.length ? empty('ยังไม่มีข้อมูลเรื่องใน Volume นี้') : ''}</section>`).join('')}
  ${TL && TL.stories.some(s => !s.lust && !s.vol) ? `<section class="section">${secHead('เรื่องอื่น ๆ')}<div class="grid lg">${TL.stories.filter(s => !s.lust && !s.vol).map(card).join('')}</div></section>` : ''}
  ${plan.some(p => p.spin) ? `<section class="section">${secHead('LCU Spin-Off (ยังไม่ได้เรียงไทม์ไลน์)')}<div class="grid lg">${plan.filter(p => p.spin).map(planCard).join('')}</div></section>` : ''}
  </div>`;
}

export async function renderStory(id) {
  const lust = id.startsWith('L');
  if (lust) { if (!(await requireAge())) return; await loadLustTimeline(); }
  const s = storyBy(lust ? id.slice(1) : id);
  if (!s || !!s.lust !== lust) { app().innerHTML = pageHead({ h1: 'ไม่พบเรื่องนี้' }) + `<div class="wrap"><section class="section">${empty('ไม่พบเรื่องนี้ในฐานข้อมูล', '<a class="btn ghost sm" href="#/universe/stories" style="margin-top:14px">กลับฐานข้อมูลเรื่อง</a>')}</section></div>`; return; }
  const ev = S.TL.events.filter(e => e.st === s.no).sort(key);
  const novel = lust ? null : ((await loadNovels()).novels || []).find(n => !n.adult && n.status !== 'draft' && String(n.story_no) === String(s.no));
  const bg = s.chars?.find(c => c.img)?.img;
  let y = null, b = '';
  for (const e of ev) { if (e.y !== y) { y = e.y; b += `<div class="tl-yr">${y ? `พ.ศ. ${be(y)}<small>ค.ศ. ${y}</small>` : ''}</div>`; } const d = dlab(e); b += `<div class="tl-ev" style="--c:${s.series.c}">${d ? `<div class="dt">${d}</div>` : ''}<div>${evText(e.t, '')}</div></div>`; }
  app().innerHTML = `<article class="${lust ? 'lz-theme' : ''}">` + pageHead({ crumbsHTML: crumbs([['หน้าแรก', '/'], lust ? ['LUSTZONE', '/lustzone'] : ['Universe', '/universe'], lust ? ['เรื่อง', null] : ['ฐานข้อมูลเรื่อง', '/universe/stories'], [s.name, null]]),
    eyebrow: `${esc(s.series.n)} · #${esc(String(s.no))}${s.vol ? ' · ' + esc(s.vol) : ''}`, h1: s.name, bg,
    extra: `<div class="chips" style="margin-top:14px">${storyYears(s) ? `<span class="chip">พ.ศ. ${storyYears(s)}</span>` : ''}<span class="chip">${s.count} เหตุการณ์</span><a class="chip" href="#/universe/timeline?v=story${lust ? '&lz=1' : ''}">ดูในไทม์ไลน์ →</a></div>${novel ? `<div style="margin-top:18px"><a class="btn" href="#/novels/${esc(novel.slug)}">อ่านนิยายเรื่องนี้</a></div>` : ''}` }) + `
  <div class="wrap">
    ${s.chars?.length ? `<section class="section">${secHead('ตัวละครที่ปรากฏ')}<div class="grid sm">${s.chars.map(c => charCard(c)).join('')}</div></section>` : ''}
    <section class="section">${secHead('ลำดับเหตุการณ์')}${b ? `<div class="tl">${b}</div>` : empty('ยังไม่มีข้อมูลเหตุการณ์')}</section>
  </div></article>`;
}
