import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { UPLOADS_DIR, ensureDataDirs } from "./paths";

/**
 * Capa de archivos.
 *
 * El disco del contenedor es sólo una CACHÉ: el hosting lo reemplaza en cada
 * despliegue. Los bytes de verdad viven en la base de datos (ver
 * `lib/repo/media.ts`), que es lo único que sobrevive.
 */
export type StoredFile = {
  /** Ruta relativa dentro del almacén, p. ej. "2026/08/a1b2c3.jpg". */
  key: string;
  /** URL pública servida por /media/[...key]. */
  url: string;
  mime: string;
  size: number;
};

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/svg+xml": "svg",
};

export const ALLOWED_IMAGE_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
]);

function extensionFor(mime: string, originalName?: string): string {
  const fromMime = EXTENSION_BY_MIME[mime];
  if (fromMime) return fromMime;

  const fromName = originalName ? path.extname(originalName).slice(1).toLowerCase() : "";
  return /^[a-z0-9]{1,5}$/.test(fromName) ? fromName : "bin";
}

/** Rechaza claves con traversal o rutas absolutas antes de tocar el disco. */
export function resolveKey(key: string): string | null {
  const normalized = path
    .normalize(key)
    .replace(/^([/\\])+/, "")
    .replace(/\\/g, "/");

  if (!normalized || normalized.startsWith("..") || path.isAbsolute(normalized)) {
    return null;
  }

  const full = path.resolve(UPLOADS_DIR, normalized);
  const root = path.resolve(UPLOADS_DIR);
  if (full !== root && !full.startsWith(root + path.sep)) return null;

  return full;
}

export function urlForKey(key: string): string {
  return `/media/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export async function saveFile(
  data: Buffer,
  options: { mime: string; originalName?: string },
): Promise<StoredFile> {
  ensureDataDirs();

  const now = new Date();
  const folder = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const name = `${crypto.randomBytes(9).toString("hex")}.${extensionFor(options.mime, options.originalName)}`;
  const key = `${folder}/${name}`;

  const destination = resolveKey(key);
  if (!destination) throw new Error("Ruta de destino inválida");

  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, data);

  return { key, url: urlForKey(key), mime: options.mime, size: data.length };
}

/** Repuebla la caché de disco. Si falla, no pasa nada: se sirve desde la base. */
export async function writeCache(key: string, data: Buffer): Promise<void> {
  try {
    const destination = resolveKey(key);
    if (!destination) return;
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, data);
  } catch {
    // Disco lleno o de sólo lectura: la base sigue sirviendo el archivo.
  }
}

export async function deleteFile(key: string): Promise<void> {
  const target = resolveKey(key);
  if (!target) return;
  await fs.rm(target, { force: true });
}

export async function readFile(
  key: string,
): Promise<{ data: Buffer; size: number; mtime: Date } | null> {
  const target = resolveKey(key);
  if (!target) return null;

  try {
    // La ruta ya se validó en resolveKey; el trazador del bundler no puede
    // saberlo y, sin esto, incluiría todo el proyecto en la salida.
    const [data, stat] = await Promise.all([
      fs.readFile(/* turbopackIgnore: true */ target),
      fs.stat(/* turbopackIgnore: true */ target),
    ]);
    return { data, size: stat.size, mtime: stat.mtime };
  } catch {
    return null;
  }
}

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  svg: "image/svg+xml",
};

export function mimeForKey(key: string): string {
  const ext = path.extname(key).slice(1).toLowerCase();
  return MIME_BY_EXTENSION[ext] ?? "application/octet-stream";
}
