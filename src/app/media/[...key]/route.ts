import { mimeForKey, readFile, writeCache } from "@/lib/storage";
import { readMediaBlob } from "@/lib/repo/media";

/**
 * Sirve los archivos subidos.
 *
 * Primero mira el disco del contenedor, que hace de caché rápida. Si no está
 * —porque el hosting reemplazó el contenedor en el último despliegue— lo
 * recupera de la base de datos y lo vuelve a dejar en disco para las próximas
 * peticiones.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ key: string[] }> },
) {
  const { key } = await context.params;
  const path = key.map(decodeURIComponent).join("/");

  const cached = await readFile(path);
  if (cached) return send(cached.data, mimeForKey(path), cached.size);

  const stored = await readMediaBlob(path);
  if (!stored) {
    return new Response("Archivo no encontrado", { status: 404 });
  }

  // Se repuebla la caché sin bloquear la respuesta: si falla, da igual.
  void writeCache(path, stored.data);

  return send(stored.data, stored.mime || mimeForKey(path), stored.data.length);
}

function send(data: Buffer, mime: string, size: number): Response {
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": mime,
      "Content-Length": String(size),
      // Las claves llevan un hash aleatorio: el contenido nunca cambia.
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
