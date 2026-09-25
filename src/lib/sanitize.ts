import sanitizeHtml from "sanitize-html";

/**
 * El cuerpo de las notas se guarda como HTML. Aunque sólo el administrador
 * publica, el HTML llega de Word/PDF y de un editor `contenteditable`, así que
 * se normaliza contra una lista blanca antes de tocar la base de datos.
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "hr",
    "h2", "h3", "h4",
    "strong", "b", "em", "i", "u", "s", "sup", "sub", "mark",
    "ul", "ol", "li",
    "blockquote", "figure", "figcaption",
    "a", "img",
    "table", "thead", "tbody", "tr", "th", "td",
    "span", "div",
  ],
  allowedAttributes: {
    a: ["href", "target", "rel", "title"],
    img: ["src", "alt", "title", "width", "height", "loading"],
    span: ["class"],
    div: ["class"],
    p: ["class"],
    figure: ["class"],
    th: ["colspan", "rowspan"],
    td: ["colspan", "rowspan"],
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesByTag: { img: ["http", "https", "data"] },
  allowProtocolRelative: false,
  transformTags: {
    // Word marca los títulos como h1; el h1 de la página es el título de la nota.
    h1: "h2",
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }),
    img: sanitizeHtml.simpleTransform("img", { loading: "lazy" }),
    b: "strong",
    i: "em",
  },
  nonTextTags: ["style", "script", "textarea", "option", "noscript"],
};

export function sanitizeBody(html: string): string {
  return sanitizeHtml(html ?? "", OPTIONS).trim();
}

/** Cierres de bloque: sin un espacio en su lugar, "<p>uno</p><p>dos</p>" daría "unodos". */
const BLOCK_END =
  /<\/(p|div|h[1-6]|li|ul|ol|tr|td|th|blockquote|figure|figcaption)>|<br\s*\/?>|<hr\s*\/?>/gi;

/** Texto plano del cuerpo, usado para búsqueda, resumen y tiempo de lectura. */
export function htmlToText(html: string): string {
  const spaced = (html ?? "").replace(BLOCK_END, " ");

  return sanitizeHtml(spaced, { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Resumen automático cuando el administrador no escribe uno. */
export function autoSummary(html: string, maxLength = 220): string {
  const text = htmlToText(html);
  if (text.length <= maxLength) return text;

  const cut = text.slice(0, maxLength);
  const lastStop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("; "));
  if (lastStop > maxLength * 0.5) return cut.slice(0, lastStop + 1);

  return cut.slice(0, cut.lastIndexOf(" ")).trimEnd() + "…";
}

/** Primera imagen del cuerpo: candidata natural a portada. */
export function firstImageSrc(html: string): string | null {
  const match = /<img[^>]+src\s*=\s*["']([^"']+)["']/i.exec(html ?? "");
  return match ? match[1] : null;
}

export function readingMinutes(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
