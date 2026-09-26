import type { MetadataRoute } from "next";
import { CATEGORIES } from "@/lib/config";
import { listPublished } from "@/lib/repo/notes";
import { siteUrl } from "@/lib/url";

/**
 * Mapa del sitio para los buscadores. Se arma en cada petición porque el
 * contenido cambia varias veces al día; no tiene sentido congelarlo al
 * compilar.
 */
export const dynamic = "force-dynamic";

/** Tope prudente: Google admite 50 000 direcciones por archivo. */
const MAX_NOTES = 2000;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const notes = await listPublished({ limit: MAX_NOTES });

  const portada: MetadataRoute.Sitemap = [
    {
      url: base,
      lastModified: notes[0]?.updatedAt ?? new Date(),
      changeFrequency: "hourly",
      priority: 1,
    },
  ];

  const secciones: MetadataRoute.Sitemap = CATEGORIES.map((category) => ({
    url: `${base}/seccion/${category.slug}`,
    changeFrequency: "daily",
    priority: 0.7,
  }));

  const notas: MetadataRoute.Sitemap = notes.map((note) => ({
    url: `${base}/nota/${note.slug}`,
    lastModified: note.updatedAt,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...portada, ...secciones, ...notas];
}
