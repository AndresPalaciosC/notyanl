import "server-only";
import mysql from "mysql2/promise";

/**
 * Única puerta de entrada a la base de datos.
 *
 * Antes esto era un archivo SQLite dentro del propio proyecto. En un hosting
 * que reconstruye la aplicación en cada despliegue, ese archivo se reemplaza
 * por el original y se pierden las notas y las cuentas. Por eso los datos
 * viven ahora en un MySQL aparte, que sobrevive a los despliegues.
 *
 * Las imágenes no vienen aquí: son archivos y van a `public/assets`
 * (ver lib/paths.ts).
 */

type GlobalWithPool = typeof globalThis & {
  __notyacPool?: mysql.Pool;
  __notyacReady?: Promise<void>;
};
const globalRef = globalThis as GlobalWithPool;

function config(): mysql.PoolOptions {
  const url = process.env.DATABASE_URL?.trim();

  // Muchos hospedajes entregan la conexión como una sola URL.
  if (url) {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: Number(parsed.port || 3306),
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      database: parsed.pathname.replace(/^\//, ""),
      ...shared(),
    };
  }

  const host = process.env.DB_HOST?.trim();
  if (!host) {
    throw new Error(
      "Falta la configuración de la base de datos. Define DATABASE_URL, " +
        "o bien DB_HOST, DB_USER, DB_PASSWORD y DB_NAME.",
    );
  }

  return {
    host,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER ?? "",
    password: process.env.DB_PASSWORD ?? "",
    database: process.env.DB_NAME ?? "",
    ...shared(),
  };
}

function shared(): mysql.PoolOptions {
  return {
    waitForConnections: true,
    // El hosting compartido corta las conexiones ociosas y suele limitar
    // cuántas admite a la vez: conviene una cifra modesta.
    connectionLimit: Number(process.env.DB_POOL_SIZE || 5),
    enableKeepAlive: true,
    charset: "utf8mb4_unicode_ci",
    timezone: "Z",
    // Las fechas se manejan como texto ISO en UTC de punta a punta; dejar que
    // el driver las convierta a Date locales sólo introduce desfases.
    dateStrings: true,
    supportBigNumbers: true,
  };
}

function createPool(): mysql.Pool {
  return mysql.createPool(config());
}

export function getPool(): mysql.Pool {
  if (!globalRef.__notyacPool) {
    globalRef.__notyacPool = createPool();
  }
  return globalRef.__notyacPool;
}

/* --------------------------------------------------------------- consultas */

/** Filas de un SELECT. */
export async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  await ready();
  const [rows] = await getPool().query(sql, params);
  return rows as T[];
}

/** Primera fila de un SELECT, o null. */
export async function queryOne<T>(
  sql: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

export type WriteResult = { insertId: number; affectedRows: number };

/** INSERT, UPDATE o DELETE. */
export async function execute(
  sql: string,
  params: unknown[] = [],
): Promise<WriteResult> {
  await ready();
  const [result] = await getPool().execute(sql, params as never);
  const header = result as mysql.ResultSetHeader;
  return {
    insertId: Number(header.insertId ?? 0),
    affectedRows: Number(header.affectedRows ?? 0),
  };
}

/* --------------------------------------------------------------- esquema */

/**
 * El esquema se asegura una sola vez por proceso. La promesa se guarda en el
 * ámbito global para que dos peticiones simultáneas al arrancar no lancen la
 * migración dos veces.
 */
function ready(): Promise<void> {
  if (!globalRef.__notyacReady) {
    globalRef.__notyacReady = migrate().catch((error) => {
      // Si falla, se olvida para que el siguiente intento vuelva a probar:
      // así un MySQL que todavía no levantaba no deja la app inservible.
      globalRef.__notyacReady = undefined;
      throw error;
    });
  }
  return globalRef.__notyacReady;
}

async function migrate(): Promise<void> {
  const pool = getPool();

  const statements = [
    `CREATE TABLE IF NOT EXISTS notes (
       id            INT AUTO_INCREMENT PRIMARY KEY,
       slug          VARCHAR(191) NOT NULL UNIQUE,
       title         TEXT NOT NULL,
       summary       TEXT NOT NULL,
       body_html     LONGTEXT NOT NULL,
       plain_text    LONGTEXT NOT NULL,
       category      VARCHAR(64) NOT NULL DEFAULT 'varias',
       author        VARCHAR(191) NOT NULL DEFAULT '',
       cover_url     TEXT NULL,
       cover_alt     VARCHAR(255) NOT NULL DEFAULT '',
       status        VARCHAR(16) NOT NULL DEFAULT 'draft',
       featured      TINYINT NOT NULL DEFAULT 0,
       source_file   VARCHAR(255) NULL,
       published_at  CHAR(24) NULL,
       created_at    CHAR(24) NOT NULL,
       updated_at    CHAR(24) NOT NULL,
       INDEX idx_notes_feed (status, published_at),
       INDEX idx_notes_category (category, status, published_at)
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS banners (
       id           INT AUTO_INCREMENT PRIMARY KEY,
       title        VARCHAR(191) NOT NULL,
       advertiser   VARCHAR(191) NOT NULL DEFAULT '',
       image_key    VARCHAR(255) NOT NULL,
       image_url    TEXT NOT NULL,
       width        INT NULL,
       height       INT NULL,
       link_url     TEXT NOT NULL,
       position     VARCHAR(16) NOT NULL DEFAULT 'sidebar',
       weight       INT NOT NULL DEFAULT 1,
       active       TINYINT NOT NULL DEFAULT 1,
       starts_at    CHAR(24) NULL,
       ends_at      CHAR(24) NULL,
       impressions  INT NOT NULL DEFAULT 0,
       clicks       INT NOT NULL DEFAULT 0,
       created_at   CHAR(24) NOT NULL,
       updated_at   CHAR(24) NOT NULL,
       INDEX idx_banners_slot (position, active)
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS users (
       id             INT AUTO_INCREMENT PRIMARY KEY,
       username       VARCHAR(64) NOT NULL UNIQUE,
       name           VARCHAR(191) NOT NULL DEFAULT '',
       password_hash  VARCHAR(255) NOT NULL,
       role           VARCHAR(16) NOT NULL DEFAULT 'editor',
       active         TINYINT NOT NULL DEFAULT 1,
       token_version  INT NOT NULL DEFAULT 1,
       created_at     CHAR(24) NOT NULL,
       updated_at     CHAR(24) NOT NULL,
       last_login_at  CHAR(24) NULL
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS settings (
       \`key\`      VARCHAR(64) PRIMARY KEY,
       value        TEXT NOT NULL,
       updated_at   CHAR(24) NOT NULL
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Contadores agregados por día: ocupa poco y responde rápido sin
    // necesidad de un motor de analítica.
    //   metric: visit | pageview | note | banner_view | banner_click
    `CREATE TABLE IF NOT EXISTS stats_daily (
       day     CHAR(10) NOT NULL,
       metric  VARCHAR(32) NOT NULL,
       ref     VARCHAR(64) NOT NULL DEFAULT '',
       count   INT NOT NULL DEFAULT 0,
       PRIMARY KEY (day, metric, ref),
       INDEX idx_stats_metric (metric, day)
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS media (
       id          INT AUTO_INCREMENT PRIMARY KEY,
       \`key\`     VARCHAR(255) NOT NULL UNIQUE,
       url         TEXT NOT NULL,
       mime        VARCHAR(64) NOT NULL,
       size        INT NOT NULL DEFAULT 0,
       width       INT NULL,
       height      INT NULL,
       kind        VARCHAR(16) NOT NULL DEFAULT 'note',
       created_at  CHAR(24) NOT NULL
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ];

  for (const statement of statements) {
    await pool.query(statement);
  }
}

/** Comprobación de conexión, para diagnósticos. */
export async function pingDatabase(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await query("SELECT 1");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
