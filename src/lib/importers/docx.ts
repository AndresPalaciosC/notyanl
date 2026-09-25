import "server-only";
import mammoth from "mammoth";
import { ALLOWED_IMAGE_MIME, saveFile } from "../storage";
import { recordMedia } from "../repo/media";
import { readImageSize } from "../images";
import { extractTitle, titleFromFilename, type ImportResult } from "./shared";

/**
 * Word → HTML. Las imágenes incrustadas se extraen al almacén y quedan
 * referenciadas por URL, para que el cuerpo guardado no cargue base64.
 */
export async function importDocx(
  buffer: Buffer,
  filename: string,
): Promise<ImportResult> {
  const warnings: string[] = [];
  let images = 0;

  const convertImage = mammoth.images.imgElement(async (image) => {
    // `altText` existe en tiempo de ejecución pero falta en los tipos de mammoth.
    const source = image as typeof image & { altText?: string };
    const mime = image.contentType || "image/png";

    if (!ALLOWED_IMAGE_MIME.has(mime)) {
      warnings.push(`Se omitió una imagen con formato no soportado (${mime}).`);
      return { src: "" };
    }

    try {
      const data = await image.read();
      const stored = await saveFile(Buffer.from(data), { mime });
      recordMedia(stored, "note", readImageSize(Buffer.from(data)));
      images++;
      return { src: stored.url, alt: source.altText || "" };
    } catch {
      warnings.push("No se pudo extraer una de las imágenes del documento.");
      return { src: "" };
    }
  });

  const result = await mammoth.convertToHtml(
    { buffer },
    {
      convertImage,
      styleMap: [
        "p[style-name='Title'] => h1:fresh",
        "p[style-name='Subtitle'] => h3:fresh",
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
        "p[style-name='Quote'] => blockquote > p:fresh",
        "p[style-name='Intense Quote'] => blockquote > p:fresh",
      ],
    },
  );

  for (const message of result.messages) {
    if (message.type === "warning") warnings.push(message.message);
  }

  // Las imágenes que no se pudieron guardar quedan como <img src=""> vacíos.
  const cleaned = result.value.replace(/<img[^>]*src=""[^>]*>/g, "");
  const { title, html } = extractTitle(cleaned, titleFromFilename(filename));

  if (!html.trim()) {
    warnings.push("El documento no contenía texto legible.");
  }

  return { title, html, images, warnings, sourceFile: filename };
}
