import "server-only";

/**
 * Envoltorio para las consultas del sitio público.
 *
 * Si la base de datos no responde, el lector debe ver el periódico vacío, no
 * un error: el encabezado, las secciones y el pie siguen ahí, y lo que falta
 * es el contenido. Devolver 500 en la portada, además de feo, hace que el
 * hosting dé el despliegue por fallido y no lo publique.
 *
 * El diagnóstico de verdad no se pierde: queda en el registro del servidor y
 * en /api/estado, que para eso está.
 */
export async function orEmpty<T>(promise: Promise<T[]>): Promise<T[]> {
  try {
    return await promise;
  } catch (error) {
    console.error("[notyac] Consulta fallida, se sirve vacío:", describe(error));
    return [];
  }
}

/** Igual, para consultas que devuelven un solo valor. */
export async function orNull<T>(promise: Promise<T | null>): Promise<T | null> {
  try {
    return await promise;
  } catch (error) {
    console.error("[notyac] Consulta fallida, se sirve vacío:", describe(error));
    return null;
  }
}

/** Igual, para contadores y agregados. */
export async function orValue<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    console.error("[notyac] Consulta fallida, se usa el valor por omisión:", describe(error));
    return fallback;
  }
}

function describe(error: unknown): string {
  if (error instanceof Error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? `${code} · ${error.message}` : error.message;
  }
  return String(error);
}
