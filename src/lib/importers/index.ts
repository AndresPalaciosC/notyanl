import "server-only";
import path from "node:path";
import { importDocx } from "./docx";
import { importPdf } from "./pdf";
import { sanitizeBody } from "../sanitize";
import { extractTitle, textToHtml, titleFromFilename, type ImportResult } from "./shared";

export type { ImportResult } from "./shared";

/** Formatos que acepta el importador de notas. */
export const SUPPORTED_EXTENSIONS = [".docx", ".pdf", ".txt", ".md", ".html", ".htm"];

export class ImportError extends Error {}

export async function importDocument(
  buffer: Buffer,
  filename: string,
): Promise<ImportResult> {
  const extension = path.extname(filename).toLowerCase();

  if (extension === ".doc") {
    throw new ImportError(
      "El formato .doc (Word 97-2003) no se puede leer. Abre el archivo en Word y guárdalo como .docx.",
    );
  }

  if (!SUPPORTED_EXTENSIONS.includes(extension)) {
    throw new ImportError(
      `Formato no soportado (${extension || "sin extensión"}). Usa ${SUPPORTED_EXTENSIONS.join(", ")}.`,
    );
  }

  const result = await run(extension, buffer, filename);

  // El cuerpo importado pasa por la misma lista blanca que el editor.
  return { ...result, html: sanitizeBody(result.html) };
}

async function run(
  extension: string,
  buffer: Buffer,
  filename: string,
): Promise<ImportResult> {
  switch (extension) {
    case ".docx":
      return importDocx(buffer, filename);

    case ".pdf":
      return importPdf(buffer, filename);

    case ".html":
    case ".htm": {
      const raw = buffer.toString("utf8");
      const body = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(raw)?.[1] ?? raw;
      const { title, html } = extractTitle(body, titleFromFilename(filename));
      return { title, html, images: 0, warnings: [], sourceFile: filename };
    }

    case ".txt":
    case ".md": {
      const html = textToHtml(buffer.toString("utf8"));
      const { title, html: body } = extractTitle(html, titleFromFilename(filename));
      return { title, html: body, images: 0, warnings: [], sourceFile: filename };
    }

    default:
      throw new ImportError("Formato no soportado.");
  }
}
