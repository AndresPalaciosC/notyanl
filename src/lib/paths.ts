import path from "node:path";
import fs from "node:fs";

/**
 * Dónde viven los archivos subidos (portadas, imágenes de notas y banners).
 *
 * Van bajo `public/assets` porque es la carpeta que el hosting conserva entre
 * despliegues. Que además sea pública no es un problema: son imágenes, y
 * salen publicadas en el sitio de todas formas.
 *
 * La base de datos NO vive aquí. Está en MySQL (ver lib/db.ts), justamente
 * porque `public` se puede descargar desde internet y ahí no puede estar algo
 * con cuentas y contraseñas.
 */

const DEFAULT_UPLOADS = path.join(process.cwd(), "public", "assets", "uploads");

function resolveUploadsDir(): string {
  const configured = process.env.UPLOADS_DIR?.trim();
  const target = configured
    ? path.resolve(/* turbopackIgnore: true */ configured)
    : DEFAULT_UPLOADS;

  try {
    fs.mkdirSync(/* turbopackIgnore: true */ target, { recursive: true });
    fs.accessSync(/* turbopackIgnore: true */ target, fs.constants.W_OK);
    return target;
  } catch {
    if (target !== DEFAULT_UPLOADS) {
      console.error(
        `[notyac] No se puede escribir en UPLOADS_DIR=${configured}. ` +
          `Se usara ${DEFAULT_UPLOADS} en su lugar.`,
      );
      return DEFAULT_UPLOADS;
    }
    // Sin carpeta donde escribir no se pueden subir imágenes, pero el sitio
    // debe seguir leyéndose: el error se da cuando alguien intente subir algo.
    console.error(`[notyac] No se puede escribir en ${target}: no se podran subir imagenes.`);
    return target;
  }
}

export const UPLOADS_DIR = resolveUploadsDir();

export function ensureDataDirs(): void {
  fs.mkdirSync(/* turbopackIgnore: true */ UPLOADS_DIR, { recursive: true });
}
