import path from "node:path";
import fs from "node:fs";

/**
 * Todo el estado persistente vive bajo un solo directorio, configurable con
 * DATA_DIR: la base SQLite y los archivos subidos.
 *
 * Si DATA_DIR apunta a una ruta que el hosting no deja crear o escribir, se
 * avisa en el registro y se cae a `./data` dentro del proyecto. Antes esto
 * lanzaba una excepción al primer acceso a la base y el sitio entero
 * respondía 500 sin decir por qué, que es un pésimo modo de fallar: una ruta
 * mal puesta en una variable de entorno no debería tumbar el sitio.
 */

const FALLBACK_DIR = path.join(process.cwd(), "data");

function usable(dir: string): boolean {
  try {
    fs.mkdirSync(/* turbopackIgnore: true */ dir, { recursive: true });
    fs.accessSync(/* turbopackIgnore: true */ dir, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function resolveDataDir(): string {
  const configured = process.env.DATA_DIR?.trim();
  if (!configured) return FALLBACK_DIR;

  const target = path.resolve(/* turbopackIgnore: true */ configured);
  if (usable(target)) return target;

  console.error(
    `[notyac] No se puede escribir en DATA_DIR=${configured}. ` +
      `Se usara ${FALLBACK_DIR} en su lugar. Revisa la ruta y los permisos: ` +
      `mientras tanto los datos podrian perderse al volver a desplegar.`,
  );
  return FALLBACK_DIR;
}

export const DATA_DIR = resolveDataDir();

export const UPLOADS_DIR = path.join(DATA_DIR, "uploads");

export const DB_FILE = path.join(DATA_DIR, "notyac.db");

export function ensureDataDirs(): void {
  fs.mkdirSync(/* turbopackIgnore: true */ UPLOADS_DIR, { recursive: true });
}
