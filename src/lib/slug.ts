/** Marcas diacríticas combinantes que deja `normalize("NFD")`. */
const COMBINING_MARKS = /[̀-ͯ]/g;

/** Convierte un título en un slug URL-safe, respetando acentos y ñ del español. */
export function slugify(input: string): string {
  const base = input
    .replace(/ñ/g, "n")
    .replace(/Ñ/g, "N")
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");

  return base || "nota";
}

/**
 * Genera un slug único consultando `exists`.
 * Agrega sufijos -2, -3, ... hasta encontrar uno libre.
 */
export function uniqueSlug(
  title: string,
  exists: (slug: string) => boolean,
): string {
  const base = slugify(title);
  if (!exists(base)) return base;

  for (let i = 2; i < 500; i++) {
    const candidate = `${base}-${i}`;
    if (!exists(candidate)) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}
