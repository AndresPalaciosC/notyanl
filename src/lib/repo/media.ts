import "server-only";
import { getDb } from "../db";
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

/** Registra un archivo ya escrito en el almacén para poder inventariarlo y borrarlo. */
export function recordMedia(
  file: StoredFile,
  kind: MediaKind,
  size?: { width: number; height: number } | null,
): void {
  getDb()
    .prepare(
      `INSERT OR IGNORE INTO media (key, url, mime, size, width, height, kind, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      file.key,
      file.url,
      file.mime,
      file.size,
      size?.width ?? null,
      size?.height ?? null,
      kind,
      nowIso(),
    );
}

/** Borra el archivo del disco y su registro. */
export async function removeMedia(key: string): Promise<void> {
  await deleteFile(key);
  getDb().prepare("DELETE FROM media WHERE key = ?").run(key);
}

export function listMedia(kind?: MediaKind, limit = 100): MediaItem[] {
  const db = getDb();
  const rows = kind
    ? db
        .prepare<[string, number], MediaItem & { created_at: string }>(
          "SELECT * FROM media WHERE kind = ? ORDER BY id DESC LIMIT ?",
        )
        .all(kind, limit)
    : db
        .prepare<[number], MediaItem & { created_at: string }>(
          "SELECT * FROM media ORDER BY id DESC LIMIT ?",
        )
        .all(limit);

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

export function mediaTotals(): { count: number; bytes: number } {
  const row = getDb()
    .prepare<[], { count: number; bytes: number | null }>(
      "SELECT COUNT(*) AS count, SUM(size) AS bytes FROM media",
    )
    .get();
  return { count: row?.count ?? 0, bytes: row?.bytes ?? 0 };
}
