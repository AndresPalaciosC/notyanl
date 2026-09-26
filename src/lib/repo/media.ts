import "server-only";
import { execute, query, queryOne } from "../db";
import { nowIso } from "../dates";
import { deleteFile, type StoredFile } from "../storage";

export type MediaKind = "note" | "cover" | "banner";

export type MediaItem = {
  id: number;
  key: string;
  url: string;
  mime: string;
  size: number;
  width: number | null;
  height: number | null;
  kind: MediaKind;
  createdAt: string;
};

type Row = {
  id: number;
  key: string;
  url: string;
  mime: string;
  size: number;
  width: number | null;
  height: number | null;
  kind: MediaKind;
  created_at: string;
};

/** Entero seguro para interpolar en LIMIT, donde no caben parámetros. */
function limitOf(value: number, fallback: number): number {
  return Number.isFinite(value) ? Math.min(1000, Math.max(1, Math.trunc(value))) : fallback;
}

/** Registra un archivo ya escrito en el almacén para poder inventariarlo y borrarlo. */
export async function recordMedia(
  file: StoredFile,
  kind: MediaKind,
  size?: { width: number; height: number } | null,
): Promise<void> {
  // IGNORE: si el mismo archivo se registra dos veces no es un error.
  await execute(
    "INSERT IGNORE INTO media (`key`, url, mime, size, width, height, kind, created_at) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [
      file.key,
      file.url,
      file.mime,
      file.size,
      size?.width ?? null,
      size?.height ?? null,
      kind,
      nowIso(),
    ],
  );
}

/** Borra el archivo del disco y su registro. */
export async function removeMedia(key: string): Promise<void> {
  await deleteFile(key);
  await execute("DELETE FROM media WHERE `key` = ?", [key]);
}

export async function listMedia(kind?: MediaKind, limit = 100): Promise<MediaItem[]> {
  const top = limitOf(limit, 100);

  const rows = kind
    ? await query<Row>(
        `SELECT * FROM media WHERE kind = ? ORDER BY id DESC LIMIT ${top}`,
        [kind],
      )
    : await query<Row>(`SELECT * FROM media ORDER BY id DESC LIMIT ${top}`);

  return rows.map((row) => ({
    id: row.id,
    key: row.key,
    url: row.url,
    mime: row.mime,
    size: row.size,
    width: row.width,
    height: row.height,
    kind: row.kind,
    createdAt: row.created_at,
  }));
}

export async function mediaTotals(): Promise<{ count: number; bytes: number }> {
  const row = await queryOne<{ count: number; bytes: number | null }>(
    "SELECT COUNT(*) AS count, SUM(size) AS bytes FROM media",
  );
  return { count: Number(row?.count ?? 0), bytes: Number(row?.bytes ?? 0) };
}
