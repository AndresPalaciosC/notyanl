import "server-only";
import { headers } from "next/headers";

/**
 * URL absoluta de la petición actual. Se necesita para los botones de
 * compartir, que deben enviar un enlace completo, y funciona detrás de un
 * proxy inverso (que es lo normal en hosting compartido).
 */
/**
 * Dirección pública del sitio. Hace falta para las cosas que se generan sin
 * una petición de por medio (mapa del sitio, robots) y para que las imágenes
 * de vista previa al compartir salgan con URL completa: WhatsApp y Facebook
 * descartan las rutas relativas y no muestran la foto.
 *
 * Se puede cambiar con la variable SITE_URL sin recompilar.
 */
export function siteUrl(): string {
  return (process.env.SITE_URL || "https://notyanl.com").replace(/\/+$/, "");
}

export async function absoluteUrl(path: string): Promise<string> {
  const incoming = await headers();

  const host =
    incoming.get("x-forwarded-host") ?? incoming.get("host") ?? "localhost:3000";
  const protocol =
    incoming.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");

  return `${protocol}://${host}${path}`;
}
