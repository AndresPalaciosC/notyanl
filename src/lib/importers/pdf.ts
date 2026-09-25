import "server-only";
import { escapeHtml, titleFromFilename, type ImportResult } from "./shared";

type PdfTextItem = {
  str: string;
  transform: number[];
  height: number;
  width: number;
};

type Line = {
  text: string;
  y: number;
  x: number;
  size: number;
};

/**
 * PDF → HTML. Un PDF no guarda estructura semántica, así que el texto se
 * reagrupa en líneas y párrafos por posición y se infiere el titular por
 * tamaño de fuente. Las imágenes no se extraen: se agregan desde el editor.
 */
export async function importPdf(
  buffer: Buffer,
  filename: string,
): Promise<ImportResult> {
  const warnings: string[] = [];

  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  const task = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
  });

  const doc = await task.promise;
  const pages: Line[][] = [];

  try {
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      const page = await doc.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(toLines(content.items as PdfTextItem[]));
      page.cleanup();
    }
  } finally {
    await task.destroy();
  }

  const allLines = pages.flat();
  if (!allLines.length) {
    return {
      title: titleFromFilename(filename),
      html: "",
      images: 0,
      warnings: [
        "El PDF no tiene texto seleccionable (parece un escaneo o una imagen). " +
          "Convierte el documento con OCR, o pega el texto a mano en el editor.",
      ],
      sourceFile: filename,
    };
  }

  const { title, bodyLines } = pickTitle(pages[0] ?? [], allLines, filename);
  const html = linesToHtml(bodyLines);

  warnings.push(
    "El texto del PDF se reconstruyó por posición: revisa saltos de párrafo y subtítulos antes de publicar.",
  );

  return { title, html, images: 0, warnings, sourceFile: filename };
}

/** Agrupa los fragmentos de texto de una página en líneas ordenadas. */
function toLines(items: PdfTextItem[]): Line[] {
  const buckets: { y: number; size: number; x: number; parts: { x: number; str: string }[] }[] = [];

  for (const item of items) {
    if (!item.str) continue;

    const x = item.transform[4];
    const y = item.transform[5];
    const size = Math.abs(item.transform[3]) || item.height || 10;
    const tolerance = Math.max(1.5, size * 0.35);

    const bucket = buckets.find((b) => Math.abs(b.y - y) <= tolerance);
    if (bucket) {
      bucket.parts.push({ x, str: item.str });
      bucket.size = Math.max(bucket.size, size);
      bucket.x = Math.min(bucket.x, x);
    } else {
      buckets.push({ y, size, x, parts: [{ x, str: item.str }] });
    }
  }

  return buckets
    .sort((a, b) => b.y - a.y)
    .map((bucket) => ({
      y: bucket.y,
      x: bucket.x,
      size: bucket.size,
      text: bucket.parts
        .sort((a, b) => a.x - b.x)
        .map((p) => p.str)
        .join("")
        .replace(/\s+/g, " ")
        .trim(),
    }))
    .filter((line) => line.text.length > 0);
}

/** El titular suele ser la línea con la fuente más grande al inicio del documento. */
function pickTitle(
  firstPage: Line[],
  allLines: Line[],
  filename: string,
): { title: string; bodyLines: Line[] } {
  const candidates = firstPage.slice(0, 8);
  const bodySize = medianSize(allLines);

  let best: Line | null = null;
  for (const line of candidates) {
    if (line.text.length < 8 || line.text.length > 160) continue;
    if (line.size <= bodySize * 1.15) continue;
    if (!best || line.size > best.size) best = line;
  }

  if (!best) {
    const first = allLines.find((l) => l.text.length >= 8 && l.text.length <= 160);
    if (first) best = first;
  }

  if (!best) return { title: titleFromFilename(filename), bodyLines: allLines };

  const title = best.text.replace(/\s+/g, " ").trim();
  return { title, bodyLines: allLines.filter((line) => line !== best) };
}

function medianSize(lines: Line[]): number {
  if (!lines.length) return 10;
  const sizes = lines.map((l) => l.size).sort((a, b) => a - b);
  return sizes[Math.floor(sizes.length / 2)];
}

/**
 * Une líneas en párrafos: un salto vertical mayor al normal, un cambio brusco
 * de tamaño de fuente o una línea previa terminada en punto abren uno nuevo.
 */
function linesToHtml(lines: Line[]): string {
  if (!lines.length) return "";

  const bodySize = medianSize(lines);
  const blocks: { size: number; text: string }[] = [];
  let current = { size: lines[0].size, text: lines[0].text };
  let previous: Line = lines[0];

  for (const line of lines.slice(1)) {
    const isHeading = line.size > bodySize * 1.12 && line.text.length < 120;
    const gap = previous.y - line.y;

    const newParagraph =
      isHeading ||
      current.size > bodySize * 1.12 ||
      gap > bodySize * 1.9 ||
      gap < 0 || // cambio de página
      /[.!?:»"]$/.test(current.text);

    if (newParagraph) {
      blocks.push(current);
      current = { size: line.size, text: line.text };
    } else {
      // Une palabras cortadas con guion al final de línea.
      current.text = /[-‑]$/.test(current.text)
        ? current.text.slice(0, -1) + line.text
        : `${current.text} ${line.text}`;
    }

    previous = line;
  }
  blocks.push(current);

  return blocks
    .map((block) => {
      const text = escapeHtml(block.text.trim());
      if (!text) return "";
      return block.size > bodySize * 1.12 && text.length < 120
        ? `<h2>${text}</h2>`
        : `<p>${text}</p>`;
    })
    .filter(Boolean)
    .join("\n");
}
