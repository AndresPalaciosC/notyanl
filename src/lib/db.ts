import "server-only";
import Database from "better-sqlite3";
import { DB_FILE, ensureDataDirs } from "./paths";

/**
 * Única puerta de entrada a la base de datos. Si algún día hay que migrar a
 * Postgres/Turso, sólo cambian los repositorios de `lib/repo/*`, no la UI.
 */

type GlobalWithDb = typeof globalThis & { __notyacDb?: Database.Database };
const globalRef = globalThis as GlobalWithDb;

function createConnection(): Database.Database {
  ensureDataDirs();
  const db = new Database(DB_FILE);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  return db;
}

function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      slug           TEXT NOT NULL UNIQUE,
      title          TEXT NOT NULL,
      summary        TEXT NOT NULL DEFAULT '',
      body_html      TEXT NOT NULL DEFAULT '',
      plain_text     TEXT NOT NULL DEFAULT '',
      category       TEXT NOT NULL DEFAULT 'varias',
      author         TEXT NOT NULL DEFAULT '',
      cover_url      TEXT,
      cover_alt      TEXT NOT NULL DEFAULT '',
      status         TEXT NOT NULL DEFAULT 'draft',
      featured       INTEGER NOT NULL DEFAULT 0,
      source_file    TEXT,
      published_at   TEXT,
      created_at     TEXT NOT NULL,
      updated_at     TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_notes_feed
      ON notes(status, published_at DESC);
    CREATE INDEX IF NOT EXISTS idx_notes_category
      ON notes(category, status, published_at DESC);

    CREATE TABLE IF NOT EXISTS banners (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      title        TEXT NOT NULL,
      advertiser   TEXT NOT NULL DEFAULT '',
      image_key    TEXT NOT NULL,
      image_url    TEXT NOT NULL,
      width        INTEGER,
      height       INTEGER,
      link_url     TEXT NOT NULL DEFAULT '',
      position     TEXT NOT NULL DEFAULT 'sidebar',
      weight       INTEGER NOT NULL DEFAULT 1,
      active       INTEGER NOT NULL DEFAULT 1,
      starts_at    TEXT,
      ends_at      TEXT,
      impressions  INTEGER NOT NULL DEFAULT 0,
      clicks       INTEGER NOT NULL DEFAULT 0,
      created_at   TEXT NOT NULL,
      updated_at   TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_banners_slot
      ON banners(position, active);

    -- Ajustes editables desde el panel (redes sociales, etc.).
    CREATE TABLE IF NOT EXISTS settings (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL
    );

    -- Contadores agregados por día. Se guarda el acumulado, no cada evento:
    -- ocupa poco y responde rápido sin necesidad de un motor de analítica.
    --   metric: visit | pageview | note | banner_view | banner_click
    --   ref:    vacío, id de nota o id de banner
    CREATE TABLE IF NOT EXISTS stats_daily (
      day    TEXT NOT NULL,
      metric TEXT NOT NULL,
      ref    TEXT NOT NULL DEFAULT '',
      count  INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (day, metric, ref)
    );

    CREATE INDEX IF NOT EXISTS idx_stats_metric ON stats_daily(metric, day);

    -- Cuentas del panel. La contraseña se guarda derivada con scrypt
    -- (ver lib/repo/users.ts), nunca en claro.
    CREATE TABLE IF NOT EXISTS users (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      username       TEXT NOT NULL UNIQUE,
      name           TEXT NOT NULL DEFAULT '',
      password_hash  TEXT NOT NULL,
      role           TEXT NOT NULL DEFAULT 'editor',
      active         INTEGER NOT NULL DEFAULT 1,
      token_version  INTEGER NOT NULL DEFAULT 1,
      created_at     TEXT NOT NULL,
      updated_at     TEXT NOT NULL,
      last_login_at  TEXT
    );

    CREATE TABLE IF NOT EXISTS media (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      key         TEXT NOT NULL UNIQUE,
      url         TEXT NOT NULL,
      mime        TEXT NOT NULL,
      size        INTEGER NOT NULL DEFAULT 0,
      width       INTEGER,
      height      INTEGER,
      kind        TEXT NOT NULL DEFAULT 'note',
      created_at  TEXT NOT NULL
    );
  `);
}

export function getDb(): Database.Database {
  if (!globalRef.__notyacDb) {
    globalRef.__notyacDb = createConnection();
  }
  return globalRef.__notyacDb;
}
