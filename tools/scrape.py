#!/usr/bin/env python3
"""Scrape the LCU Google Site into JSON + WebP images (mirrors the in-browser extractor).

usage: scrape.py OUT_JSON IMG_ROOT
Writes images to IMG_ROOT/NN/<id>.webp (100 per folder) and a JSON file with
{nav, images:{id:{w,h,path}}, pages:[{path,title,banner,secs}]}.
"""
import hashlib, io, json, os, re, sys, time, urllib.parse
from concurrent.futures import ThreadPoolExecutor
import requests
from bs4 import BeautifulSoup, NavigableString, Tag
from PIL import Image

SITE = 'https://sites.google.com/view/lowclassunivers'
BASE = '/view/lowclassunivers'
S = requests.Session()
S.headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36'
S.headers['Accept-Language'] = 'th,en;q=0.8'


def get(url, binary=False):
    for i in range(5):
        try:
            r = S.get(url, timeout=60)
            if r.status_code == 200:
                return r.content if binary else r.text
            last = r.status_code
        except Exception as e:  # noqa
            last = e
        time.sleep(1 + i)
    raise RuntimeError(f'GET {url[:90]} -> {last}')


RESERVED = {'%%%02X' % ord(c) for c in ';/?:@&=+$,#'}


def decode_uri(s):
    # same as JS decodeURI: keep reserved characters percent-encoded
    parts = re.split(r'((?:%[0-9A-Fa-f]{2})+)', s)
    out = []
    for p in parts:
        if p.startswith('%'):
            toks = re.findall(r'%[0-9A-Fa-f]{2}', p)
            buf = ''
            for t in toks:
                if t.upper() in RESERVED:
                    out.append(urllib.parse.unquote(buf)); buf = ''; out.append(t)
                else:
                    buf += t
            out.append(urllib.parse.unquote(buf))
        else:
            out.append(p)
    return ''.join(out)


def esc(t):
    return t.replace('<', '&lt;').replace('>', '&gt;')


def hidden(el):
    return el.get('aria-hidden') == 'true'


def inl(n):
    o = ''
    for c in n.children:
        if isinstance(c, NavigableString):
            if type(c).__name__ in ('Comment', 'Script', 'Stylesheet', 'Doctype'):
                continue
            o += esc(str(c))
            continue
        if not isinstance(c, Tag):
            continue
        t = c.name.upper()
        if hidden(c) or t in ('SVG', 'SCRIPT', 'STYLE'):
            continue
        if t == 'BR':
            o += '<br>'
            continue
        s = inl(c)
        if not s:
            continue
        st = c.get('style') or ''
        if t == 'A':
            h = c.get('href') or ''
            if h.startswith('#'):
                continue
            s = '<a href="%s">%s</a>' % (decode_uri(h).replace('"', ''), s)
        else:
            if re.search(r'font-weight:\s*(700|bold)', st) or t in ('B', 'STRONG'):
                s = '<b>%s</b>' % s
            if re.search(r'font-style:\s*italic', st) or t in ('I', 'EM'):
                s = '<i>%s</i>' % s
        o += s
    return o.replace('</b><b>', '').replace('</i><i>', '')


def strip_size(src):
    return re.sub(r'=[^=/]*$', '', src)


def walk(n, out):
    for c in n.children:
        if not isinstance(c, Tag):
            continue
        t = c.name.upper()
        if hidden(c):
            continue
        if re.fullmatch(r'H[1-6]', t):
            x = inl(c).strip()
            if x:
                out.append({'t': 'h', 'l': int(t[1]), 'x': x})
            continue
        if t == 'P':
            x = inl(c).strip()
            if x:
                out.append({'t': 'p', 'x': x, 'c': 1 if re.search(r'text-align:\s*center', c.get('style') or '') else 0})
            continue
        if t in ('UL', 'OL'):
            items = [inl(li).strip() for li in c.find_all(recursive=False)]
            out.append({'t': 'list', 'o': 1 if t == 'OL' else 0, 'items': [i for i in items if i]})
            continue
        if t == 'IMG':
            s = c.get('src') or ''
            if 'sitesv-images' in s:
                b = {'t': 'img', 'src': strip_size(s)}
                a = c.find_parent('a')
                if a and a.get('href') and not a['href'].startswith('#'):
                    b['href'] = decode_uri(a['href'])
                out.append(b)
            continue
        if t == 'IFRAME':
            out.append({'t': 'embed', 'src': c.get('src') or ''})
            continue
        if t == 'A' and not c.find_parent('p') and not c.find('img'):
            h = c.get('href') or ''
            x = c.get_text().strip()
            if h and not h.startswith('#') and x:
                out.append({'t': 'btn', 'href': decode_uri(h), 'x': x})
                continue
        walk(c, out)


def extract(html, url):
    d = BeautifulSoup(html, 'lxml')
    banner = None
    bi = d.select_one('img.r9CsCb, img.lzy1Td')
    if bi:
        banner = strip_size(bi['src'])
    secs = []
    for s in d.find_all('section'):
        out = []
        walk(s, out)
        if out:
            secs.append(out)
    path = urllib.parse.unquote(urllib.parse.urlparse(url).path).replace(BASE, '')
    title = re.sub(r'^LOW CLASS UNIVERSE - ', '', d.title.get_text() if d.title else '')
    return d, {'path': path, 'title': title, 'banner': banner, 'secs': secs}


def nav_tree(d):
    def tree(ul):
        res = []
        for li in ul.find_all('li', recursive=False):
            a = li.find('a')
            sub = li.find('ul')
            p = urllib.parse.unquote(urllib.parse.urlparse(a['href']).path).replace(BASE, '') if a else ''
            res.append({'t': a.get_text().strip() if a else '', 'p': p, 'c': tree(sub) if sub else []})
        return res
    nav = d.find('nav')
    ul = nav.find('ul') if nav else None
    return tree(ul) if ul else []


def main():
    out_json, img_root = sys.argv[1], sys.argv[2]
    home = get(SITE)
    hd = BeautifulSoup(home, 'lxml')
    links = []
    for a in hd.find_all('a', href=True):
        h = urllib.parse.urljoin(SITE, a['href']).split('#')[0].split('?')[0]
        if BASE in h and h not in links:
            links.append(h)
    nav = nav_tree(hd)
    print('pages', len(links), flush=True)
    images, order, pages = {}, [], []

    def do_img(src):
        raw = get(src + '=w1280', binary=True)
        hid = hashlib.sha256(raw).hexdigest()[:12]
        if hid in images:
            return hid
        images[hid] = {}
        try:
            return _convert(hid, raw)
        except Exception:
            images.pop(hid, None)
            raise

    def _convert(hid, raw):
        im = Image.open(io.BytesIO(raw))
        im = im.convert('RGBA') if im.mode in ('P', 'LA', 'RGBA') else im.convert('RGB')
        k = min(1, 1200 / max(im.size))
        w, h = round(im.width * k), round(im.height * k)
        if k < 1:
            im = im.resize((w, h), Image.LANCZOS)
        buf = io.BytesIO()
        im.save(buf, 'WEBP', quality=82, method=6)
        images[hid] = {'w': w, 'h': h, 'data': buf.getvalue()}
        order.append(hid)
        return hid

    for n, u in enumerate(links):
        for attempt in range(4):
            html = get(u)
            _, p = extract(html, u)
            jobs = []
            if p['banner']:
                jobs.append((p, 'banner', p['banner']))
            for s in p['secs']:
                for b in s:
                    if b['t'] == 'img':
                        jobs.append((b, 'src', b['src']))
            fails = 0

            def run(j):
                o, k, src = j
                try:
                    o[k] = do_img(src)
                    return 0
                except Exception as e:  # noqa
                    print('  img fail', e, flush=True)
                    return 1
            with ThreadPoolExecutor(6) as ex:
                fails = sum(ex.map(run, jobs))
            if not fails:
                break
            print('retry page', p['path'], fails, flush=True)
        else:
            raise SystemExit('failed page ' + u)
        pages.append(p)
        if n % 20 == 0:
            print(n, p['path'], 'imgs', len(order), flush=True)

    out_images = {}
    for i, hid in enumerate(order):
        folder = '%02d' % (i // 100 + 1)
        os.makedirs(os.path.join(img_root, folder), exist_ok=True)
        rel = 'img/%s/%s.webp' % (folder, hid)
        with open(os.path.join(img_root, folder, hid + '.webp'), 'wb') as f:
            f.write(images[hid]['data'])
        out_images[hid] = {'w': images[hid]['w'], 'h': images[hid]['h'], 'path': rel}
    json.dump({'site': SITE, 'nav': nav, 'images': out_images, 'pages': pages},
              open(out_json, 'w', encoding='utf-8'), ensure_ascii=False)
    print('done pages', len(pages), 'images', len(out_images), flush=True)


if __name__ == '__main__':
    main()
