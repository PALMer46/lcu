// Reusable UI components (pure functions returning HTML strings).
import { S, X, esc, img, title, strip, isExt, HOME } from './core.js';

export const ICON = {
  search: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  menu: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  close: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  down: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
  up: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 15 6-6 6 6"/></svg>',
  arrow: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  back: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>',
  ext: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
  gear: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>',
  list: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>',
};

export function crumbs(items) {
  return `<nav class="crumbs" aria-label="breadcrumb">${items.map((x, i) => i < items.length - 1 && x[1]
    ? `<a href="#${x[1]}">${esc(x[0])}</a><span class="sep" aria-hidden="true">/</span>` : `<span aria-current="page">${esc(x[0])}</span>`).join('')}</nav>`;
}
// breadcrumb trail derived from an encyclopedia path
export function pathCrumbs(p) {
  const parts = p.split('/').filter(Boolean); let acc = ''; const out = [['หน้าแรก', '/']];
  if (!p.startsWith('/universe')) out.push(['Universe', '/universe']);
  parts.forEach((x, i) => { acc += '/' + x; out.push([title(acc), i < parts.length - 1 && S.D.pages[acc] ? acc : null]); });
  return crumbs(out);
}

export function pageHead({ crumbsHTML = '', eyebrow = '', h1, sub = '', bg = null, extra = '' }) {
  return `<header class="phead ${bg ? '' : 'plain'}"><div class="bg">${bg ? img(bg, { alt: '' }) : ''}</div><div class="wrap">
    ${crumbsHTML}${eyebrow ? `<div class="eyebrow${/[\u0E00-\u0E7F]/.test(eyebrow) ? ' th' : ''}" style="margin-top:14px">${eyebrow}</div>` : ''}
    <h1 class="h1">${esc(h1)}</h1>${sub ? `<p class="lead">${sub}</p>` : ''}${extra}</div></header>`;
}

export const secHead = (t, more = '', moreHref = '') =>
  `<div class="sec-head"><h2 class="h2">${t}</h2>${more ? `<a class="more" href="#${moreHref}">${more} →</a>` : ''}</div>`;

export function charCard(c, { eager = false } = {}) {
  const cat = title(c.cat);
  return `<a class="card" href="#${c.p}"><div class="art">${img(c.img, { alt: c.n, eager })}</div>
    ${c.tag ? `<div class="tagline"><span class="badge gold">${esc(c.tag)}</span></div>` : ''}
    <div class="cap"><div class="nm">${esc(c.n)}</div><div class="sb">${esc(cat)}</div></div></a>`;
}
export function pageCard(p, { sub = '', wide = true, src = null } = {}) {
  const n = title(p);
  return `<a class="card ${wide ? 'wide' : ''}" href="#${p}"><div class="art">${img(src || X.cardImg.get(p) || null, { alt: n })}</div>
    <div class="cap"><div class="nm">${esc(n)}</div>${sub ? `<div class="sb">${sub}</div>` : ''}</div></a>`;
}
export function item({ href, t, d = '', th = null, ph = '', ext = false }) {
  return `<a class="item" href="${ext ? esc(href) : '#' + esc(href)}"${ext ? ' target="_blank" rel="noopener"' : ''}>
    ${th ? `<div class="th">${img(th, { alt: '' })}</div>` : `<div class="th ph" aria-hidden="true">${esc(ph || 'L')}</div>`}
    <div style="min-width:0"><div class="t">${t}</div>${d ? `<div class="d">${d}</div>` : ''}</div></a>`;
}
export const empty = (t, d = '', ico = '∅') => `<div class="empty"><div class="ico" aria-hidden="true">${ico}</div><b>${t}</b>${d}</div>`;
export const skeletonGrid = (n = 8) => `<div class="grid">${Array.from({ length: n }, () => '<div class="skel" style="aspect-ratio:3/4"></div>').join('')}</div>`;

/* ---------- generic Google-Sites section renderer (keeps every original block) ---------- */
export function linkCard(b) {
  const h = b.href; const ext = isExt(h); const t = h.startsWith('#/') ? h.slice(1) : null;
  const name = t && S.D.pages[t] ? title(t) : '';
  return `<a class="card wide" href="${esc(h)}"${ext ? ' target="_blank" rel="noopener"' : ''}><div class="art">${img(b.src, { alt: name || 'ลิงก์' })}</div>${name ? `<div class="cap"><div class="nm">${esc(name)}</div></div>` : ''}</a>`;
}
export function blockHTML(b) {
  switch (b.t) {
    case 'h': { const l = Math.min(b.l + 1, 4); return `<h${l}>${b.x}</h${l}>`; }
    case 'p': return `<p${b.c ? ' class="c"' : ''}>${b.x}</p>`;
    case 'list': return `<${b.o ? 'ol' : 'ul'}>${b.items.map(i => `<li>${i}</li>`).join('')}</${b.o ? 'ol' : 'ul'}>`;
    case 'img': return b.href ? linkCard(b) : `<div class="pic">${img(b.src, { cls: 'z', alt: '' })}</div>`;
  }
  return '';
}
// paragraph that is only a short label followed by a list → styled sub-heading (text unchanged)
export function proseHTML(blocks) {
  return blocks.map((b, i) => {
    const nx = blocks[i + 1];
    if (b.t === 'p' && nx?.t === 'list' && strip(b.x).trim().length <= 30) return `<div class="lbl-h">${b.x}</div>`;
    return blockHTML(b);
  }).join('');
}
export function secHTML(s, alt = '') {
  const imgs = s.filter(b => b.t === 'img'); const txt = s.filter(b => b.t !== 'img');
  if (imgs.length && imgs.every(b => b.href && isExt(b.href)) && txt.every(b => b.t === 'h'))
    return `${txt.map(blockHTML).join('')}<div class="blk social">${imgs.map(b => `<a href="${esc(b.href)}" target="_blank" rel="noopener" aria-label="${esc(new URL(b.href).host)}">${img(b.src, { alt: new URL(b.href).host })}</a>`).join('')}</div>`;
  if (imgs.some(b => b.href && !isExt(b.href))) return linkSectionHTML(s, alt);
  if (!txt.length) {
    if (imgs.length === 1) return `<div class="blk gal one">${img(imgs[0].src, { cls: 'z', alt })}</div>`;
    return `<div class="blk gal">${imgs.map(b => b.href ? linkCard(b) : img(b.src, { cls: 'z', alt })).join('')}</div>`;
  }
  if (imgs.length === 1 && s[0].t === 'img' && !imgs[0].href)
    return `<div class="split"><div class="pic">${img(imgs[0].src, { cls: 'z', alt })}</div><div class="prose">${proseHTML(txt)}</div></div>`;
  return `<div class="blk prose">${s.every(b => b.t !== 'img') ? proseHTML(s) : s.map(blockHTML).join('')}</div>`;
}
// Google-Sites "card" sections: [section heading] then [linked image, caption heading]* with optional text.
// A heading directly after a linked image is its caption (kept as the card name); other headings stay headings.
function linkSectionHTML(s, alt) {
  let out = '', cards = [], prose = [];
  const flushCards = () => { if (cards.length) out += `<div class="blk grid ${cards.length <= 2 ? 'lg' : ''}">${cards.join('')}</div>`; cards = []; };
  const flushProse = () => { if (prose.length) out += `<div class="blk prose">${proseHTML(prose)}</div>`; prose = []; };
  for (let i = 0; i < s.length; i++) {
    const b = s[i], nx = s[i + 1];
    if (b.t === 'img' && b.href) {
      flushProse();
      const cap = nx?.t === 'h' ? (i++, nx.x) : null;
      const t = b.href.startsWith('#/') ? b.href.slice(1) : null;
      const n = X.groupMembers.get(t)?.length;
      cards.push(`<a class="card ${S.D.chars.some(c => c.p === t) ? '' : 'wide'}" href="${esc(b.href)}"${isExt(b.href) ? ' target="_blank" rel="noopener"' : ''}><div class="art">${img(b.src, { alt: strip(cap || (t && S.D.pages[t] ? title(t) : '')) })}</div>
        <div class="cap"><div class="nm">${esc(cap ? strip(cap) : (t && S.D.pages[t] ? title(t) : ''))}</div>${n ? `<div class="sb">${n} สมาชิกในฐานข้อมูล</div>` : ''}</div></a>`);
    } else if (b.t === 'img') { flushProse(); flushCards(); out += `<div class="blk gal one">${img(b.src, { cls: 'z', alt })}</div>`; }
    else if (b.t === 'h') { flushCards(); flushProse(); out += `<div class="sec-head" style="margin-top:var(--s7)"><h2 class="h2">${b.x}</h2></div>`; }
    else { flushCards(); prose.push(b); }
  }
  flushCards(); flushProse();
  return out;
}
// merge a lone portrait section with the following text section
export function mergeLead(secs) {
  const out = [];
  for (let i = 0; i < secs.length; i++) {
    const a = secs[i], b = secs[i + 1];
    if (a.length === 1 && a[0].t === 'img' && !a[0].href && b?.length && b.every(x => x.t !== 'img')) { out.push([a[0], ...b]); i++; }
    else out.push(a);
  }
  return out;
}
export function backlinksHTML(p, exclude = []) {
  const back = (X.back.get(p) || []).filter(k => !exclude.includes(k) && k !== HOME && !S.D.cats.includes(k) && k !== '/ตวละคร');
  return back.length ? `<section class="section">${secHead('ถูกกล่าวถึงใน')}<div class="chips">${back.map(k => `<a class="chip" href="#${k}">${esc(title(k))}</a>`).join('')}</div></section>` : '';
}
