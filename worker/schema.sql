-- LCU reading platform — Cloudflare D1 (SQLite) schema
-- Apply: npx wrangler d1 execute lcu --remote --file=worker/schema.sql
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS volumes (
  id          TEXT PRIMARY KEY,               -- 'vol-1'
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  description TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS categories (
  id       TEXT PRIMARY KEY,                  -- 'general', 'lustzone'
  name     TEXT NOT NULL,
  slug     TEXT NOT NULL UNIQUE,
  is_adult INTEGER NOT NULL DEFAULT 0 CHECK (is_adult IN (0,1))
);

CREATE TABLE IF NOT EXISTS novels (
  id           TEXT PRIMARY KEY,              -- stable id from the import tool, e.g. 'nv_3fa2c91b0d'
  title        TEXT NOT NULL,
  slug         TEXT NOT NULL UNIQUE,
  description  TEXT,
  cover_url    TEXT,
  author       TEXT,
  volume_id    TEXT REFERENCES volumes(id),
  category_id  TEXT NOT NULL REFERENCES categories(id),
  status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('ongoing','completed','coming_soon','draft')),
  published_at TEXT,
  updated_at   TEXT
);
CREATE INDEX IF NOT EXISTS idx_novels_volume ON novels(volume_id);
CREATE INDEX IF NOT EXISTS idx_novels_category ON novels(category_id);

CREATE TABLE IF NOT EXISTS chapters (
  id             TEXT PRIMARY KEY,            -- '<novel_id>:<chapter_number>'
  novel_id       TEXT NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  chapter_number INTEGER NOT NULL,
  title          TEXT,
  content        TEXT,                        -- only for server-protected (LUSTZONE) chapters; public text is static
  published_at   TEXT,
  updated_at     TEXT,
  is_published   INTEGER NOT NULL DEFAULT 0 CHECK (is_published IN (0,1)),
  UNIQUE (novel_id, chapter_number)
);

CREATE TABLE IF NOT EXISTS reading_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  novel_id    TEXT NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  chapter_id  TEXT REFERENCES chapters(id) ON DELETE CASCADE,
  reader_id   TEXT NOT NULL,                  -- random pseudonymous id generated in the browser (no fingerprinting)
  session_id  TEXT,
  event_type  TEXT NOT NULL CHECK (event_type IN ('novel_view','chapter_view')),
  created_at  INTEGER NOT NULL                -- unix ms
);
CREATE INDEX IF NOT EXISTS idx_ev_novel ON reading_events(novel_id, event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_ev_dedupe ON reading_events(reader_id, chapter_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ev_reader ON reading_events(reader_id);

CREATE TABLE IF NOT EXISTS reading_progress (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  reader_id         TEXT NOT NULL,
  novel_id          TEXT NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  chapter_id        TEXT REFERENCES chapters(id) ON DELETE SET NULL,
  progress_position REAL NOT NULL DEFAULT 0 CHECK (progress_position BETWEEN 0 AND 1),
  updated_at        INTEGER NOT NULL,
  UNIQUE (reader_id, novel_id)
);

-- simple fixed-window rate limit (per hashed IP, per minute)
CREATE TABLE IF NOT EXISTS rate_limits (
  k      TEXT PRIMARY KEY,                    -- '<ip_hash>:<minute>'
  n      INTEGER NOT NULL,
  expire INTEGER NOT NULL
);

INSERT OR IGNORE INTO volumes (id,name,slug,sort_order) VALUES
 ('vol-1','LCU Vol.1 ดิสโทเปีย','vol-1',1),
 ('vol-2','LCU Vol.2 คณะกัลยา','vol-2',2),
 ('vol-3','LCU Vol.3 The Metahuman Era','vol-3',3);
INSERT OR IGNORE INTO categories (id,name,slug,is_adult) VALUES
 ('general','LCU Novels','general',0),
 ('lustzone','LUSTZONE','lustzone',1);
