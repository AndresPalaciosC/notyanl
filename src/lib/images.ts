import { BANNER_ASPECT, BANNER_ASPECT_TOLERANCE } from "./config";

export type Dimensions = { width: number; height: number };

/**
 * Lee ancho/alto directamente de las cabeceras del archivo.
 * Evita una dependencia nativa de procesamiento de imagen (sharp), que suele
 * ser el primer punto de fricción en hosting compartido.
 */
export function readImageSize(buf: Buffer): Dimensions | null {
  return png(buf) ?? gif(buf) ?? webp(buf) ?? jpeg(buf);
}

function png(buf: Buffer): Dimensions | null {
  if (buf.length < 24) return null;
  if (buf.readUInt32BE(0) !== 0x89504e47) return null;
  if (buf.toString("ascii", 12, 16) !== "IHDR") return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function gif(buf: Buffer): Dimensions | null {
  if (buf.length < 10) return null;
  const sig = buf.toString("ascii", 0, 6);
  if (sig !== "GIF87a" && sig !== "GIF89a") return null;
  return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
}

function webp(buf: Buffer): Dimensions | null {
  if (buf.length < 30) return null;
  if (buf.toString("ascii", 0, 4) !== "RIFF") return null;
  if (buf.toString("ascii", 8, 12) !== "WEBP") return null;

  const format = buf.toString("ascii", 12, 16);

  if (format === "VP8 ") {
    return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
  }

  if (format === "VP8L") {
    const bits = buf.readUInt32LE(21);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    };
  }

  if (format === "VP8X") {
    const width = 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16));
    const height = 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16));
    return { width, height };
  }

  return null;
}

function jpeg(buf: Buffer): Dimensions | null {
  if (buf.length < 4 || buf.readUInt16BE(0) !== 0xffd8) return null;

  let offset = 2;
  while (offset + 9 < buf.length) {
    if (buf[offset] !== 0xff) {
      offset++;
      continue;
    }
    const marker = buf[offset + 1];
    // SOF0..SOF15, saltando los marcadores que no describen el frame.
    const isSof =
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc;

    if (isSof) {
      return {
        height: buf.readUInt16BE(offset + 5),
        width: buf.readUInt16BE(offset + 7),
      };
    }

    const segmentLength = buf.readUInt16BE(offset + 2);
    if (segmentLength < 2) return null;
    offset += 2 + segmentLength;
  }
  return null;
}

export type AspectCheck = {
  ratio: number | null;
  ok: boolean;
  message: string | null;
};

/** Valida la proporción 3.75:1 esperada para los banners. */
export function checkBannerAspect(size: Dimensions | null): AspectCheck {
  if (!size || !size.height) {
    return {
      ratio: null,
      ok: true,
      message: "No se pudieron leer las dimensiones; se mostrará recortado a 3.75:1.",
    };
  }

  const ratio = size.width / size.height;
  const drift = Math.abs(ratio - BANNER_ASPECT) / BANNER_ASPECT;

  if (drift <= BANNER_ASPECT_TOLERANCE) {
    return { ratio, ok: true, message: null };
  }

  const suggestedHeight = Math.round(size.width / BANNER_ASPECT);
  return {
    ratio,
    ok: false,
    message:
      `La imagen es ${size.width}×${size.height} (${ratio.toFixed(2)}:1). ` +
      `Se recortará para encajar en 3.75:1 — el tamaño ideal sería ` +
      `${size.width}×${suggestedHeight} px.`,
  };
}
