#!/usr/bin/env python3
"""LCU novel import tool — scan → review → build. Source folders are NEVER modified.

1) SCAN a folder of novels and produce an editable manifest + an HTML preview report:
     python3 tools/import_novels.py scan "<novels folder>" --out import/
   Writes import/manifest.json and import/report.html. Nothing is published.

2) REVIEW import/manifest.json: set "approved": true on each novel to publish, and check
   volume ("vol-1" | "vol-2" | "vol-3" | null), status, title, slug, author, chapter order.

3) BUILD the approved, non-adult novels into the website:
     python3 tools/import_novels.py build import/manifest.json
   Writes novels/<slug>/meta.json, novels/<slug>/<n>.json, covers, updates novels/index.json
   (merge only — existing novels are never deleted) and worker/seed.sql for the stats database.
   Adult (LUSTZONE) novels are refused for the public repo; pass --private-out <dir> to export them
   as SQL for the protected Worker database instead.

Supported sources: .txt .md .markdown .html .htm .json (and .docx if python-docx is installed).
Folder layout: one sub-folder per novel, one file per chapter (or a single file = one chapter).
"""
import argparse, hashlib, html as htmlmod, json, os, re, shutil, sys, unicodedata
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TEXT_EXT = {'.txt', '.md', '.markdown', '.html', '.htm', '.json', '.docx'}
IMG_EXT = {'.jpg', '.jpeg', '.png', '.webp'}
THAI_DIGITS = str.maketrans('๐๑๒๓๔๕๖๗๘๙', '0123456789')
CH_RE = re.compile(r'(?:ตอนที่|ตอน|บทที่|บท|chapter|ch|ep|episode)\s*[\.:_-]?\s*(\d+)', re.I)
ADULT_RE = re.compile(r'lust\s*zone|lustzone|18\+|nc\s*-?\s*18|\[L[\d.]+\]', re.I)
VOL_RE = re.compile(r'vol(?:ume)?\.?\s*(\d+)', re.I)


def read_text(p: Path) -> str:
    raw = p.read_bytes()
    for enc in ('utf-8-sig', 'utf-8', 'cp874', 'tis-620', 'utf-16'):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode('utf-8', errors='replace')


class _H(HTMLParser):
    BLOCK = {'p': 'p', 'div': 'p', 'h1': 'h', 'h2': 'h', 'h3': 'h', 'h4': 'h', 'li': 'p', 'blockquote': 'p'}
    def __init__(self):
        super().__init__(); self.blocks = []; self.cur = None; self.buf = []; self.skip = 0
    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style'): self.skip += 1
        elif tag == 'br': self.buf.append('\n')
        elif tag == 'hr': self.flush(); self.blocks.append({'t': 'hr'})
        elif tag in self.BLOCK: self.flush(); self.cur = self.BLOCK[tag]
    def handle_endtag(self, tag):
        if tag in ('script', 'style'): self.skip -= 1
        elif tag in self.BLOCK: self.flush()
    def handle_data(self, d):
        if not self.skip: self.buf.append(d)
    def flush(self):
        t = re.sub(r'[ \t\r\f\v]+', ' ', ''.join(self.buf)).strip('\n ').strip()
        if t: self.blocks.append({'t': self.cur or 'p', 'x': t})
        self.buf = []; self.cur = None


def to_blocks(p: Path):
    """Convert a chapter file to [{'t':'p'|'h'|'hr','x':text}] without changing the words."""
    ext = p.suffix.lower()
    if ext == '.json':
        d = json.loads(read_text(p))
        if isinstance(d, dict) and isinstance(d.get('blocks'), list): return d.get('title'), d['blocks']
        paras = d.get('paragraphs') or d.get('content') if isinstance(d, dict) else d
        if isinstance(paras, str): paras = paras.split('\n\n')
        return (d.get('title') if isinstance(d, dict) else None), [{'t': 'p', 'x': str(x)} for x in paras if str(x).strip()]
    if ext in ('.html', '.htm'):
        h = _H(); h.feed(read_text(p)); h.flush(); return None, h.blocks
    if ext == '.docx':
        try:
            import docx  # type: ignore
        except ImportError:
            raise RuntimeError('python-docx not installed (pip install python-docx) — or export the chapter as .txt')
        from docx.oxml.ns import qn  # type: ignore
        doc = docx.Document(str(p)); out = []
        for para in doc.paragraphs:
            for blip in para._p.findall('.//' + qn('a:blip')):   # images keep their position in the text
                rid = blip.get(qn('r:embed'))
                if rid and rid in doc.part.related_parts: out.append({'t': 'img', 'x': '', 'ref': rid})
            if para.text.strip():
                out.append({'t': 'h' if (para.style.name or '').lower().startswith('heading') else 'p', 'x': para.text.strip('\n')})
        return None, out
    text = read_text(p).replace('\r\n', '\n').replace('\r', '\n')
    lines = text.split('\n')
    blank = sum(1 for l in lines if not l.strip())
    blocks = []
    if ext in ('.md', '.markdown') or blank >= max(2, len(lines) * 0.05):
        # paragraph mode: blank line separates paragraphs, single newlines are kept inside the paragraph
        for chunk in re.split(r'\n\s*\n', text):
            c = chunk.strip('\n')
            if not c.strip(): continue
            s = c.strip()
            if ext in ('.md', '.markdown') and re.match(r'^#{1,6}\s', s): blocks.append({'t': 'h', 'x': re.sub(r'^#{1,6}\s+', '', s)}); continue
            if re.fullmatch(r'(\*\s*){3,}|(-\s*){3,}|(_\s*){3,}|[~=]{3,}', s): blocks.append({'t': 'hr'}); continue
            blocks.append({'t': 'p', 'x': c.strip()})
    else:
        # line mode (common in Thai manuscripts): every non-empty line is a paragraph
        for l in lines:
            s = l.strip()
            if not s: continue
            if re.fullmatch(r'(\*\s*){3,}|(-\s*){3,}|[~=]{3,}', s): blocks.append({'t': 'hr'}); continue
            blocks.append({'t': 'p', 'x': s})
    return None, blocks


def chapter_number(name: str):
    n = name.translate(THAI_DIGITS)
    m = re.match(r'^\s*\d+\.(\d+)\.', n) or CH_RE.search(n) or re.match(r'^\s*(\d+)', n) or re.search(r'(\d+)(?!.*\d)', n)
    return int(m.group(1)) if m else None


def first_heading(blocks):
    if blocks and blocks[0].get('t') in ('h', 'p'):
        x = blocks[0].get('x', '').strip()
        if blocks[0]['t'] == 'h' or (len(x) <= 80 and CH_RE.search(x.translate(THAI_DIGITS))):
            return x
    return None


def clean_title(s: str) -> str:
    return re.sub(r'\s+', ' ', (s or '').replace('\u00a0', ' ')).strip()


def tnorm(s: str) -> str:
    return re.sub(r'[\s:：\-–—_.()\[\]"“”]+', '', unicodedata.normalize('NFC', s or '')).lower()


def strip_titles(blocks, novel_title):
    """Remove the in-document novel title line and use a following 'ตอนที่ …' line as chapter title.
    Only these heading lines are removed; story text is never changed."""
    doc_title = ch_title = None
    b = list(blocks)
    while b and b[0].get('t') in ('p', 'h') and tnorm(b[0]['x']) and (tnorm(b[0]['x']) == tnorm(novel_title) or (len(b[0]['x']) < 90 and tnorm(novel_title) in tnorm(b[0]['x']) and not CH_RE.search(b[0]['x']))):
        doc_title = doc_title or b[0]['x'].strip(); b = b[1:]
    # combined line: "<novel title> ตอนที่ 1 …"
    if b and b[0].get('t') in ('p', 'h') and len(b[0]['x']) < 120 and tnorm(b[0]['x']).startswith(tnorm(novel_title)):
        m = re.search(r'(ตอนที่|ตอนพิเศษ|บทที่)', b[0]['x'])
        if m and tnorm(b[0]['x'][:m.start()]) == tnorm(novel_title):
            doc_title = doc_title or b[0]['x'][:m.start()].strip(); ch_title = b[0]['x'][m.start():].strip(); return doc_title, ch_title, b[1:]
    if b and b[0].get('t') in ('p', 'h') and len(b[0]['x']) < 100 and re.match(r'^\s*(ตอนที่|ตอนพิเศษ|บทที่|บทนำ|บทส่งท้าย|chapter)', b[0]['x'].translate(THAI_DIGITS), re.I):
        ch_title = b[0]['x'].strip(); b = b[1:]
    return doc_title, ch_title, b


def slugify(s: str) -> str:
    s = unicodedata.normalize('NFC', s).strip().lower()
    s = re.sub(r'[^\w฀-๿]+', '-', s).strip('-')
    s = re.sub(r'-{2,}', '-', s) or 'novel'
    return 'n-' + s if s.startswith('vol-') else s


def novel_id(slug: str) -> str:
    return 'nv_' + hashlib.sha1(slug.encode()).hexdigest()[:10]


def norm_hash(blocks) -> str:
    t = ''.join(b.get('x', '') for b in blocks)
    return hashlib.sha1(re.sub(r'\s+', '', t).encode()).hexdigest()


# ------------------------------------------------------------------ scan
def scan(src: Path, out: Path):
    out.mkdir(parents=True, exist_ok=True)
    existing = json.loads((ROOT / 'novels/index.json').read_text(encoding='utf-8')).get('novels', [])
    COVER_DIR = re.compile(r'^(ปก|covers?)$', re.I)
    chapterish = lambda f: bool(re.match(r'^\s*\d+\.\d+\.', f.stem) or CH_RE.search(f.stem.translate(THAI_DIGITS)) or 'ตอนพิเศษ' in f.stem)
    lead_no = lambda name: (lambda m: m.group(1) if m else None)(re.match(r'^\s*(\d+(?:\.\d+)*)\.?\s', name))
    strip_no = lambda name: re.sub(r'^\s*\d+(?:\.\d+)*\.?\s+', '', name).strip()
    # covers: images inside folders called "ปก"/"cover", matched by leading story number or title
    covers = {}
    for img_p in src.rglob('*'):
        if img_p.is_file() and img_p.suffix.lower() in IMG_EXT and COVER_DIR.match(img_p.parent.name):
            key = (str(img_p.parent.parent), lead_no(img_p.stem) or tnorm(img_p.stem))
            covers[key] = img_p
    units = []   # (title_source_name, folder_for_meta, [chapter files])
    for d in sorted([src] + [x for x in src.rglob('*') if x.is_dir()]):
        if COVER_DIR.match(d.name): continue
        texts = sorted([f for f in d.iterdir() if f.is_file() and f.suffix.lower() in TEXT_EXT and not f.name.startswith(('.', '~$'))])
        if not texts: continue
        if all(chapterish(f) for f in texts) and d != src:
            units.append((d.name, d, texts))                    # folder = one novel, files = chapters
        else:
            for f in texts: units.append((f.stem, d, [f]))      # each file = one complete novel (single chapter)
    novels, seen_hash, errors = [], {}, []
    for name, folder, texts in units:
        story_no = lead_no(name); title = strip_no(name)
        parent_for_cover = folder.parent if len(texts) > 1 or folder != texts[0].parent else folder
        cover = covers.get((str(folder.parent if len(texts) > 1 else folder), story_no)) or covers.get((str(folder.parent if len(texts) > 1 else folder), tnorm(title)))
        if not cover:
            local = [f for f in folder.iterdir() if f.suffix.lower() in IMG_EXT] if len(texts) > 1 else []
            cover = local[0] if len(local) == 1 else None
        rel = (folder if len(texts) > 1 else texts[0]).relative_to(src)
        chs, doc_titles = [], []
        for f in texts:
            try:
                t, blocks = to_blocks(f)
            except Exception as e:  # noqa
                errors.append(f'{f}: {e}'); continue
            if not blocks:
                errors.append(f'{f}: ไม่มีเนื้อหา'); continue
            dt, ct, body = strip_titles(blocks, title)
            if dt: doc_titles.append(dt)
            n = chapter_number(f.stem) if len(texts) > 1 else 1
            chs.append({'source': str(f.relative_to(src)), 'n': n, 'title': clean_title(t or ct or (strip_no(f.stem) if len(texts) > 1 else (dt or title))),
                        'chars': sum(len(b.get('x', '')) for b in body), 'paragraphs': len(body), 'images': sum(1 for b in body if b['t'] == 'img'),
                        'hash': norm_hash(body), 'duplicate_of': None, 'include': True})
        if not chs: continue
        # order: explicit numbers first (natural), then remaining by file name; renumber 1..N only where missing
        chs.sort(key=lambda c: (c['n'] is None, c['n'] or 0, c['source']))
        used = {c['n'] for c in chs if c['n']}
        nxt = 1
        for c in chs:
            if c['n'] is None:
                while nxt in used: nxt += 1
                c['n'] = nxt; used.add(nxt); c['n_guessed'] = True
        for c in chs:  # duplicates: the first file in chapter order is kept, later copies are excluded (include=false)
            if c['hash'] in seen_hash: c['duplicate_of'] = seen_hash[c['hash']]; c['include'] = False
            else: seen_hash[c['hash']] = f"{folder.name}/{Path(c['source']).name}"
        nums = [c['n'] for c in chs if c['include']]
        warn = []
        if len(set(nums)) != len(nums): warn.append('เลขตอนซ้ำกัน')
        if nums and sorted(nums) != list(range(min(nums), min(nums) + len(nums))): warn.append('เลขตอนไม่ต่อเนื่อง (อาจมีตอนขาด)')
        if any(c['duplicate_of'] for c in chs): warn.append('พบเนื้อหาตอนซ้ำกับไฟล์อื่น')
        path_txt = str(rel)
        vm = VOL_RE.search(path_txt)
        if doc_titles and tnorm(doc_titles[0]) == tnorm(title): title = clean_title(doc_titles[0])   # the author's own formatting, e.g. "PAE PA LAI : แก๊งแห่งไชยา"
        slug = f'lcu-{story_no}'.replace('.', '-') if story_no else slugify(title)   # short, stable URL: #/novels/lcu-17
        if not cover: warn.append('ไม่พบภาพปก')
        if any(c.get('images') for c in chs): warn.append(f"มีภาพประกอบในเนื้อหา {sum(c.get('images', 0) for c in chs)} ภาพ (จะนำเข้าตามตำแหน่งเดิม)")
        dup_novel = next((e['slug'] for e in existing if e['slug'] == slug or e['title'] == title), None)
        if dup_novel: warn.append(f'มีนิยายชื่อนี้ในเว็บแล้ว ({dup_novel}) — การ build จะอัปเดตเรื่องเดิม')
        novels.append({
            'approved': False, 'title': title, 'slug': slug, 'id': novel_id(slug), 'author': '', 'description': '',
            'volume': f'vol-{vm.group(1)}' if vm else None, 'category': 'lustzone' if ADULT_RE.search(path_txt) else 'general',
            'adult': bool(ADULT_RE.search(path_txt)), 'status': None, 'story_no': story_no, 'source_folder': path_txt,
            'cover': str(cover.relative_to(src)) if cover else None, 'warnings': warn, 'chapters': chs,
        })
    manifest = {'source_root': str(src.resolve()), 'scanned_at': datetime.now(timezone.utc).isoformat(timespec='seconds'), 'novels': novels, 'errors': errors}
    (out / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    (out / 'report.html').write_text(report_html(manifest), encoding='utf-8')
    print(f'พบนิยาย {len(novels)} เรื่อง, {sum(len(n["chapters"]) for n in novels)} ตอน, ข้อผิดพลาด {len(errors)}')
    print('manifest:', out / 'manifest.json'); print('report  :', out / 'report.html')


def report_html(m):
    e = htmlmod.escape
    rows = []
    for n in m['novels']:
        rows.append(f"<section><h2>{e(n['title'])} {'<span class=a>18+ LUSTZONE</span>' if n['adult'] else ''}</h2>"
                    f"<p>slug: <code>{e(n['slug'])}</code> · volume: <b>{e(str(n['volume']))}</b> · cover: {e(str(n['cover']))} · {len(n['chapters'])} ตอน</p>"
                    + ''.join(f"<p class=w>⚠ {e(w)}</p>" for w in n['warnings'])
                    + '<table><tr><th>#</th><th>ชื่อตอน</th><th>ไฟล์</th><th>ตัวอักษร</th><th>หมายเหตุ</th></tr>'
                    + ''.join(f"<tr{'' if c.get('include', True) else ' style=opacity:.45'}><td>{c['n']}{'*' if c.get('n_guessed') else ''}</td><td>{e(c['title'])}</td><td>{e(c['source'])}</td><td>{c['chars']:,}</td><td>{'ซ้ำกับ ' + e(c['duplicate_of']) + ' — จะไม่นำเข้า' if c['duplicate_of'] else ''}</td></tr>" for c in n['chapters'])
                    + '</table></section>')
    errs = ''.join(f'<li>{e(x)}</li>' for x in m['errors'])
    return f"""<!doctype html><meta charset=utf-8><title>LCU import report</title><style>body{{font:15px/1.6 system-ui;background:#0b0b0e;color:#ddd;max-width:1100px;margin:auto;padding:24px}}h1,h2{{color:#fff}}table{{width:100%;border-collapse:collapse;margin:8px 0 28px}}td,th{{border-bottom:1px solid #333;padding:6px 8px;text-align:left;font-size:14px}}.w{{color:#e6c88a}}.a{{background:#ff5c8a;color:#000;font-size:12px;padding:2px 6px;border-radius:4px}}code{{color:#e6c88a}}</style>
<h1>LCU import report</h1><p>สแกนเมื่อ {e(m['scanned_at'])} · ต้นฉบับ: {e(m['source_root'])}</p><p>* = เลขตอนที่ระบบเดาจากลำดับไฟล์ ควรตรวจสอบ · ยังไม่มีการเผยแพร่ใด ๆ จนกว่าจะตั้งค่า approved: true ใน manifest.json แล้วรันคำสั่ง build</p>
{('<h2>ข้อผิดพลาด</h2><ul>' + errs + '</ul>') if errs else ''}{''.join(rows)}"""


# ------------------------------------------------------------------ build
def build(manifest_path: Path, private_out: Path | None):
    m = json.loads(manifest_path.read_text(encoding='utf-8'))
    src = Path(m['source_root'])
    idx_p = ROOT / 'novels/index.json'
    idx = json.loads(idx_p.read_text(encoding='utf-8'))
    vols = {v['id']: v['name'] for v in idx.get('volumes', [])}
    report, seed = [], []
    now = datetime.now(timezone.utc).isoformat(timespec='seconds')
    sq = lambda s: "NULL" if s is None else "'" + str(s).replace("'", "''") + "'"
    for n in m['novels']:
        if not n.get('approved'):
            report.append(f'ข้าม (ยังไม่อนุมัติ): {n["title"]}'); continue
        n['chapters'] = [c for c in n['chapters'] if c.get('include', True)]
        nums = [c['n'] for c in n['chapters']]
        if len(set(nums)) != len(nums):
            report.append(f'ผิดพลาด: {n["title"]} มีเลขตอนซ้ำ — แก้ใน manifest ก่อน'); continue
        slug = slugify(n['slug']); nid = n.get('id') or novel_id(slug)
        adult = bool(n.get('adult')) or n.get('category') == 'lustzone'
        chapters = []
        for c in sorted(n['chapters'], key=lambda c: c['n']):
            _, blocks = to_blocks(src / c['source'])
            # the novel / chapter title lines are shown as page headings, so they are not repeated in the body
            _, _, blocks = strip_titles(blocks, n['title'])
            if blocks and blocks[0].get('x', '').strip() == (c.get('title') or '').strip(): blocks = blocks[1:]
            chapters.append((c, blocks))
        seed.append(f"INSERT INTO novels (id,title,slug,description,cover_url,author,volume_id,category_id,status,published_at,updated_at) VALUES ({sq(nid)},{sq(n['title'])},{sq(slug)},{sq(n.get('description'))},NULL,{sq(n.get('author'))},{sq(n.get('volume'))},{sq('lustzone' if adult else 'general')},{sq(n.get('status', 'ongoing'))},{sq(now)},{sq(now)}) "
                    f"ON CONFLICT(id) DO UPDATE SET title=excluded.title, description=excluded.description, author=excluded.author, volume_id=excluded.volume_id, status=excluded.status, updated_at=excluded.updated_at;")
        for c, blocks in chapters:
            content = sq(json.dumps(blocks, ensure_ascii=False)) if adult else 'NULL'
            seed.append(f"INSERT INTO chapters (id,novel_id,chapter_number,title,content,published_at,updated_at,is_published) VALUES ({sq(f'{nid}:{c['n']}')},{sq(nid)},{c['n']},{sq(c['title'])},{content},{sq(now)},{sq(now)},1) "
                        f"ON CONFLICT(id) DO UPDATE SET title=excluded.title, content=excluded.content, updated_at=excluded.updated_at, is_published=1;")
        if adult:
            if not private_out:
                report.append(f'ปฏิเสธ: {n["title"]} เป็นเนื้อหา LUSTZONE — ห้ามเขียนลง repo สาธารณะ (ใช้ --private-out)'); seed = [s for s in seed if nid not in s]; continue
            report.append(f'LUSTZONE (ส่วนตัว): {n["title"]} {len(chapters)} ตอน → {private_out}'); continue
        d = ROOT / 'novels' / slug; d.mkdir(parents=True, exist_ok=True)
        cover_url = None
        if n.get('cover'):
            cp = src / n['cover']
            try:
                from PIL import Image  # type: ignore
                im = Image.open(cp); im.thumbnail((900, 1350)); im.convert('RGB').save(d / 'cover.webp', 'WEBP', quality=85); cover_url = f'novels/{slug}/cover.webp'
            except Exception:
                shutil.copy2(cp, d / ('cover' + cp.suffix.lower())); cover_url = f'novels/{slug}/cover{cp.suffix.lower()}'
        meta_ch = []
        for c, blocks in chapters:
            blocks = save_images(src / c['source'], blocks, d, slug, c['n'])
            (d / f"{c['n']}.json").write_text(json.dumps({'n': c['n'], 'title': c['title'], 'blocks': blocks}, ensure_ascii=False), encoding='utf-8')
            chars = sum(len(b.get('x', '')) for b in blocks)
            meta_ch.append({'n': c['n'], 'title': c['title'], 'minutes': max(1, round(chars / 800))})
        meta = {'id': nid, 'slug': slug, 'title': n['title'], 'chapters': meta_ch}
        (d / 'meta.json').write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding='utf-8')
        entry = {'id': nid, 'slug': slug, 'title': n['title'], 'story_no': n.get('story_no'), 'description': n.get('description', ''), 'author': n.get('author', ''),
                 'cover': cover_url, 'volume': n.get('volume'), 'volume_name': vols.get(n.get('volume')), 'category': 'general', 'adult': False,
                 'status': n.get('status', 'ongoing'), 'chapters': len(meta_ch), 'published_at': now[:10], 'updated_at': now[:10]}
        old = next((i for i, e in enumerate(idx['novels']) if e['id'] == nid or e['slug'] == slug), None)
        if old is None: idx['novels'].append(entry)
        else: entry['published_at'] = idx['novels'][old].get('published_at', entry['published_at']); idx['novels'][old] = entry
        report.append(f'นำเข้า: {n["title"]} ({len(meta_ch)} ตอน) → novels/{slug}/')
    idx_p.write_text(json.dumps(idx, ensure_ascii=False, indent=2), encoding='utf-8')
    (ROOT / 'worker').mkdir(exist_ok=True)
    (ROOT / 'worker/seed.sql').write_text('\n'.join(s for s in seed if not _is_adult_stmt(s, m)) + '\n', encoding='utf-8')
    if private_out:
        private_out.mkdir(parents=True, exist_ok=True)
        (private_out / 'lustzone-seed.sql').write_text('\n'.join(s for s in seed if _is_adult_stmt(s, m)) + '\n', encoding='utf-8')
    print('\n'.join(report)); print('อัปเดต novels/index.json และ worker/seed.sql แล้ว')


def save_images(docx_path, blocks, dest, slug, ch_no):
    """Write images embedded in a .docx chapter next to it (WebP) and point the block at the file."""
    if not any(b.get('t') == 'img' for b in blocks): return blocks
    import io, docx  # type: ignore
    from PIL import Image  # type: ignore
    doc = docx.Document(str(docx_path)); out = []; k = 0
    for b in blocks:
        if b.get('t') != 'img': out.append(b); continue
        k += 1
        try:
            im = Image.open(io.BytesIO(doc.part.related_parts[b['ref']].blob)); im.thumbnail((1400, 1400))
            name = f'img-{ch_no}-{k}.webp'; im.convert('RGB').save(dest / name, 'WEBP', quality=82)
            out.append({'t': 'img', 'x': '', 'src': f'novels/{slug}/{name}', 'w': im.width, 'h': im.height})
        except Exception as e:  # noqa
            print('  ! ภาพในเนื้อหาแปลงไม่ได้:', docx_path.name, e)
    return out


def _is_adult_stmt(stmt, m):
    ids = {(n.get('id') or novel_id(slugify(n['slug']))) for n in m['novels'] if n.get('adult') or n.get('category') == 'lustzone'}
    return any(f"'{i}'" in stmt for i in ids)


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest='cmd', required=True)
    a = sub.add_parser('scan'); a.add_argument('folder'); a.add_argument('--out', default='import')
    b = sub.add_parser('build'); b.add_argument('manifest'); b.add_argument('--private-out')
    args = ap.parse_args()
    if args.cmd == 'scan': scan(Path(args.folder), Path(args.out))
    else: build(Path(args.manifest), Path(args.private_out) if args.private_out else None)
