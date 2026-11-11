# LCU API (Cloudflare Worker + D1)

Real reading analytics, optional progress sync, and server-side protection for LUSTZONE chapters.
The public website works without it; statistics simply show "ยังไม่เปิดระบบ" until it is deployed.

## Deploy (one time, ~15 minutes)
1. Create a free Cloudflare account, then on your computer: `npm i -g wrangler` and `wrangler login`.
2. `cd worker && wrangler d1 create lcu` → copy the printed `database_id` into `wrangler.toml`.
3. `wrangler d1 execute lcu --remote --file=schema.sql`
4. Secrets (never commit them):
   `wrangler secret put AGE_SECRET` (any long random text) · `wrangler secret put IP_SALT` (another random text)
5. `wrangler deploy` → note the URL, e.g. `https://lcu-api.<you>.workers.dev`
6. Put that URL in `assets/js/config.js` → `API_BASE`, commit to GitHub.
7. After each novel import: `wrangler d1 execute lcu --remote --file=seed.sql`

## Endpoints
| Method | Path | Notes |
|---|---|---|
| POST | /v1/events | `{type:'chapter_view'|'novel_view', novel, chapter, reader, session}` — validated against published novels; same reader + chapter within `DEDUPE_MINUTES` is not counted again; per-IP rate limit (`RATE_LIMIT_PER_MIN`, IP stored only as a salted hash); common bot user-agents ignored |
| GET | /v1/stats?scope= | `global`, `vol-1..n`, `novel:<id>`, `lustzone` (needs age token) |
| POST | /v1/age | `{confirm:true}` → signed token valid `AGE_TOKEN_DAYS`; self-declaration, **not** verified age assurance |
| GET | /v1/lz/chapter?novel=&n= | LUSTZONE chapter text, only with a valid token; `noindex`, `no-store` |
| GET/PUT | /v1/progress?reader= | optional server copy of reading progress |

## Metric definitions
- **Views**: counted chapter visits after de-duplication.
- **Unique readers**: distinct pseudonymous browser ids (random UUID, no fingerprinting) — an *estimate*: one person on two devices counts twice; clearing browser data creates a new id.
- **Volume / LUSTZONE views**: sums over published novels in that volume / adult category. `global` excludes LUSTZONE.

## Costs
Workers Free + D1 Free (5M rows read/day, 100k rows written/day, 5 GB) covers a large readership at 0 cost.
Above that: Workers Paid $5/month.

## Before storing LUSTZONE content here
Read the hosting terms and get Thai legal advice first (Computer Crime Act s.14(4) concerns pornographic data
accessible to the general public). Adult chapters are only ever exported with `tools/import_novels.py build --private-out`.
