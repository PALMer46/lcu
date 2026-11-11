#!/usr/bin/env python3
"""Export approved LUSTZONE novels from an import manifest into a PRIVATE JSON file for the
Cloudflare D1 database (see worker/deploy.ps1). The output must never be committed to the public repo.

usage: export_lustzone.py MANIFEST OUT_JSON
"""
import base64, io, json, sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import import_novels as imp  # noqa: E402

m = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
src = Path(m['source_root'])
now = datetime.now(timezone.utc).isoformat(timespec='seconds')
out = []
for n in m['novels']:
    if not (n.get('adult') and n.get('approved')):
        continue
    slug = n['slug']; nid = n.get('id') or imp.novel_id(slug)
    cover = None
    if n.get('cover'):
        from PIL import Image
        im = Image.open(src / n['cover']); im.thumbnail((600, 900))
        b = io.BytesIO(); im.convert('RGB').save(b, 'WEBP', quality=80)
        cover = {'mime': 'image/webp', 'data': base64.b64encode(b.getvalue()).decode()}
    chs = []
    for c in sorted([c for c in n['chapters'] if c.get('include', True)], key=lambda c: c['n']):
        _, blocks = imp.to_blocks(src / c['source'])
        _, _, blocks = imp.strip_titles(blocks, n['title'])
        blocks = [b for b in blocks if b.get('t') != 'img']   # (no embedded images in these files)
        chs.append({'n': c['n'], 'title': c['title'], 'blocks': blocks})
    out.append({'id': nid, 'slug': slug, 'title': n['title'], 'story_no': n.get('story_no'), 'status': n.get('status') or 'ongoing',
                'updated_at': now, 'cover': cover, 'chapters': chs})
    print(f"{n['title']}: {len(chs)} ตอน")
Path(sys.argv[2]).write_text(json.dumps({'novels': out}, ensure_ascii=False), encoding='utf-8')
print('written', sys.argv[2])
