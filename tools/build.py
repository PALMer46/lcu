#!/usr/bin/env python3
"""Build data.json for the LCU site from the Google Sites export (tools/raw.json)."""
import json, re, sys, urllib.parse, html

SRC = sys.argv[1]
OUT = sys.argv[2]
d = json.load(open(SRC, encoding='utf-8'))
BASE = '/view/lowclassunivers'
IM = d['images']

def fix_href(h):
    if not h:
        return h
    if h.startswith('https://www.google.com/url?'):
        q = urllib.parse.parse_qs(urllib.parse.urlparse(h).query).get('q')
        if q:
            h = q[0]
    if h.startswith('https://sites.google.com' + BASE):
        h = h[len('https://sites.google.com'):]
    if h.startswith(BASE):
        p = h[len(BASE):].split('#')[0].rstrip('/')
        return '#' + (p or '/')
    return h

def fix_html(x):
    return re.sub(r'href="([^"]*)"', lambda m: 'href="%s"' % html.escape(fix_href(html.unescape(m.group(1))), quote=True), x)

def img(i):
    if not i or i not in IM or 'path' not in IM[i]:
        return None
    m = IM[i]
    return [m['path'], m['w'], m['h']]

nav_titles = {}
def walk(n):
    for x in n:
        nav_titles[x['p']] = re.sub(r'^[^\w฀-๿]+\s*', '', x['t']).strip()
        walk(x['c'])
walk(d['nav'])

pages = {}
for p in d['pages']:
    path = p['path'].rstrip('/') or '/หนาแรก'
    if path in pages:
        continue
    secs = []
    for s in p['secs']:
        out = []
        for b in s:
            b = dict(b)
            b.pop('err', None)
            if b['t'] == 'img':
                r = img(b.get('src'))
                if not r:
                    continue
                b['src'] = r
                if b.get('href'):
                    b['href'] = fix_href(b['href'])
            elif b['t'] in ('p', 'h'):
                b['x'] = fix_html(b['x'])
                if not b.get('c'):
                    b.pop('c', None)
            elif b['t'] == 'list':
                b['items'] = [fix_html(i) for i in b['items']]
            elif b['t'] == 'embed':
                continue
            out.append(b)
        if out:
            secs.append(out)
    title = nav_titles.get(path) or re.sub(r'^[^\w฀-๿]+\s*', '', p['title']).strip()
    pages[path] = {'title': title, 'banner': img(p.get('banner')), 'secs': secs}

# parent / category
def parent(path):
    return path.rsplit('/', 1)[0] if path.count('/') > 1 else None
for k, v in pages.items():
    v['parent'] = parent(k)

# characters: pages under /ตวละคร/<cat>/<name>
CATS = ['/ตวละคร/มนษย', '/ตวละคร/อมนษย', '/ตวละคร/ปศาจ-เทพ', '/ตวละคร/สงมชวตโลกหมพานต']
cards = {}  # target path -> card image (first linked image found on a listing page)
for k, v in pages.items():
    for s in v['secs']:
        for b in s:
            if b['t'] == 'img' and b.get('href', '').startswith('#/'):
                t = b['href'][1:]
                cards.setdefault(t, b['src'])

chars = []
for k, v in pages.items():
    if any(k.startswith(c + '/') for c in CATS):
        cat = k.rsplit('/', 1)[0]
        # tag: heading preceding the card on its category page (e.g. Spin-off)
        chars.append({'p': k, 'cat': cat})

# spin-off / sub heading tags from category listing pages
tags = {}
for c in CATS:
    cur = None
    for s in pages.get(c, {}).get('secs', []):
        for b in s:
            if b['t'] == 'h':
                cur = re.sub('<[^>]+>', '', b['x']).strip()
            elif b['t'] == 'img' and b.get('href', '').startswith('#/'):
                tags.setdefault(b['href'][1:], cur)

# group membership: group pages that link to the character
groups = [k for k in pages if k.startswith('/กลม-องคกร/')]
member = {}
for g in groups:
    for s in pages[g]['secs']:
        for b in s:
            hrefs = []
            if b['t'] == 'img' and b.get('href'):
                hrefs.append(b['href'])
            for x in [b.get('x', '')] + b.get('items', []):
                hrefs += re.findall(r'href="(#/[^"]*)"', x)
            for h in hrefs:
                member.setdefault(h[1:], [])
                if g not in member[h[1:]]:
                    member[h[1:]].append(g)

catname = {c: pages[c]['title'] for c in CATS if c in pages}
for ch in chars:
    p = pages[ch['p']]
    t = tags.get(ch['p'])
    first_p = ''
    for s in p['secs']:
        for b in s:
            if b['t'] == 'p':
                first_p += re.sub('<[^>]+>', '', b['x']) + ' '
    ch.update({
        'n': p['title'],
        'img': cards.get(ch['p']) or next((b['src'] for s in p['secs'] for b in s if b['t'] == 'img'), None),
        'g': member.get(ch['p'], []),
        'tag': t if t and t != catname.get(ch['cat']) else None,
        'q': first_p[:600],
    })

out = {
    'nav': d['nav'],
    'pages': pages,
    'chars': chars,
    'groups': groups,
    'cats': CATS,
}
# strip emoji from nav for path mapping but keep emoji for display
json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('pages', len(pages), 'chars', len(chars), 'groups', len(groups), 'imgs', len(IM),
      'with card', sum(1 for c in chars if c['img']), 'size', len(json.dumps(out, ensure_ascii=False)))
