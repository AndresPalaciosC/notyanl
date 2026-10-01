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

/**
 * Registra un archivo subido, guardando también sus bytes.
 *
 * Los bytes van a la base y no sólo al disco porque el hosting reemplaza el
 * sistema de archivos del contenedor en cada despliegue: las imágenes
 * guardadas sólo en disco desaparecen, y las notas quedan apuntando a fotos
 * rotas. El disco se sigue usando como caché (ver lib/storage.ts).
 */
export async function recordMedia(
  file: StoredFile,
  kind: MediaKind,
  size?: { width: number; height: number } | null,
  data?: Buffer,
): Promise<void> {
  // Si el mismo archivo se registra dos veces, se conservan los bytes.
  await execute(
    "INSERT INTO media (`key`, url, mime, size, width, height, kind, created_at, data) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) " +
      "ON DUPLICATE KEY UPDATE data = COALESCE(VALUES(data), data)",
    [
      file.key,
      file.url,
      file.mime,
      file.size,
      size?.width ?? null,
      size?.height ?? null,
      kind,
      nowIso(),
      data ?? null,
    ],
  );
}

/** Los bytes de un archivo, para cuando ya no están en el disco del contenedor. */
export async function readMediaBlob(
  key: string,
): Promise<{ data: Buffer; mime: string } | null> {
  const row = await queryOne<{ data: Buffer | null; mime: string }>(
    "SELECT data, mime FROM media WHERE `key` = ?",
    [key],
  );
  if (!row?.data) return null;
  return { data: Buffer.from(row.data), mime: row.mime };
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
