import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/url";

/**
 * El sitio entero es público salvo el panel y lo que sólo sirve de plomería:
 * la salida de los banners (que cuenta un clic y redirige) y el receptor de
 * estadísticas no tienen nada que indexar.
 */
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/admin/", "/api/", "/r/"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
