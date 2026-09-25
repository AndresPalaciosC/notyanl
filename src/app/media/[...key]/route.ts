import { mimeForKey, readFile } from "@/lib/storage";

/**
 * Sirve los archivos subidos desde DATA_DIR/uploads. Se hace por ruta y no
 * desde /public para que el contenido subido no dependa del árbol estático
 * y pueda migrarse a un almacenamiento externo cambiando sólo lib/storage.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ key: string[] }> },
) {
  const { key } = await context.params;
  const path = key.map(decodeURIComponent).join("/");

  const file = await readFile(path);
  if (!file) {
    return new Response("Archivo no encontrado", { status: 404 });
  }

  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": mimeForKey(path),
      "Content-Length": String(file.size),
      // Las claves llevan un hash aleatorio: el contenido nunca cambia.
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
