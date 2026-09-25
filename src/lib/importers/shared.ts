import "server-only";

export type ImportResult = {
  /** Título detectado en el documento (o el nombre del archivo como respaldo). */
  title: string;
  /** Cuerpo en HTML, listo para cargarse en el editor. */
  html: string;
  /** Cuántas imágenes se extrajeron y guardaron. */
  images: number;
  /** Avisos para mostrar al administrador (no son errores). */
  warnings: string[];
  sourceFile: string;
};

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Nombre de archivo sin extensión, presentable como título de respaldo. */
export function titleFromFilename(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  if (!base) return "Nota sin título";
  return base.charAt(0).toUpperCase() + base.slice(1);
}

const HEADING_RE = /<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/i;
const PARAGRAPH_RE = /<p[^>]*>([\s\S]*?)<\/p>/i;

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Saca el título del cuerpo: si el documento arranca con un encabezado (o con
 * un párrafo corto que hace de titular), se usa como título y se quita del
 * cuerpo para no duplicarlo en la página de la nota.
 */
export function extractTitle(
  html: string,
  fallback: string,
): { title: string; html: string } {
  const trimmed = html.trim();

  const heading = HEADING_RE.exec(trimmed);
  if (heading && trimmed.indexOf(heading[0]) < 40) {
    const title = stripTags(heading[2]);
    if (title.length > 2) {
      return { title, html: trimmed.replace(heading[0], "").trim() };
    }
  }

  const paragraph = PARAGRAPH_RE.exec(trimmed);
  if (paragraph && trimmed.indexOf(paragraph[0]) < 20) {
    const text = stripTags(paragraph[1]);
    const looksLikeTitle =
      text.length > 12 && text.length <= 140 && !/[.;:]$/.test(text);
    if (looksLikeTitle) {
      return { title: text, html: trimmed.replace(paragraph[0], "").trim() };
    }
  }

  return { title: fallback, html: trimmed };
}

/** Convierte texto plano en párrafos HTML, respetando líneas en blanco. */
export function textToHtml(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br />")}</p>`)
    .join("\n");
}
