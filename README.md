# lcu
สารานุกรม LOW CLASS UNIVERSE (LCU) — https://palmer46.github.io/lcu/

## โครงสร้าง
| ส่วน | ไฟล์ |
|---|---|
| หน้าเว็บ (shell) | `index.html`, `404.html` |
| ดีไซน์ซิสเต็ม | `assets/css/lcu.css` (tokens สี/ตัวอักษร/ระยะห่าง + components) |
| โค้ด | `assets/js/app.js` (router/header) · `core.js` (ข้อมูล) · `ui.js` (components) · `stats.js` · `pages/*.js` |
| ข้อมูลสารานุกรม | `data.json` + `img/` (สร้างจาก Google Sites ด้วย `tools/scrape.py` + `tools/build.py`) |
| ไทม์ไลน์ | `timeline.json` (เรื่องหลัก) · `timeline-lz.json` (Lust Zone โหลดหลังยืนยันอายุ) — แก้ไขที่ไฟล์นี้โดยตรง (บรรทัด `## ชื่อเรื่อง` = เริ่มเรื่องใหม่) |
| นิยาย | `novels/index.json`, `novels/<slug>/` — สร้างด้วย `tools/import_novels.py` เท่านั้น |
| API สถิติ | `worker/` (Cloudflare Worker + D1) ดู `worker/README.md` |

## Routes (hash)
`#/` · `#/universe` · `#/ตวละคร` (+ หมวดเดิม) · `#/กลม-องคกร` · `#/ตางโลก` · `#/universe/timeline` · `#/universe/stories` ·
`#/novels` · `#/novels/vol-N` · `#/novels/<slug>` · `#/novels/<slug>/<ตอน>` · `#/lustzone` · `#/about` · `#/stats` · `#/ค้นหา?q=`
— ลิงก์เดิมทุกหน้าจาก Google Sites (`#/ตวละคร/...`, `#/กลม-องคกร/...`) ยังใช้ได้เหมือนเดิม

## นำเข้านิยาย
```
python3 tools/import_novels.py scan "<โฟลเดอร์นิยาย>" --out import/
# ตรวจ import/report.html แล้วแก้ import/manifest.json → "approved": true
python3 tools/import_novels.py build import/manifest.json
```
ห้าม commit เนื้อหา LUSTZONE ลง repo นี้ (เครื่องมือจะปฏิเสธให้อัตโนมัติ)

## อัปเดตข้อมูลจาก Google Sites
GitHub → Actions → "Build LCU site from Google Sites" → Run workflow (รันด้วยมือเท่านั้น)
