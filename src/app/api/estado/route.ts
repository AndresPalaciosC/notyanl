import { NextResponse } from "next/server";
import { pingDatabase } from "@/lib/db";

/**
 * Diagnóstico de despliegue: dice si la aplicación levantó y si alcanza la
 * base de datos. Pensado para mirarlo justo después de publicar, cuando lo
 * único que se ve por fuera es un 500 sin explicación.
 *
 * No revela host, usuario ni contraseña: sólo si conecta y, si no, el código
 * del error (ECONNREFUSED, ER_ACCESS_DENIED_ERROR...), que es lo que hace
 * falta para saber qué variable está mal.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const db = await pingDatabase();

  if (db.ok) {
    return NextResponse.json({ app: "ok", db: "ok" });
  }

  // Del mensaje del driver sólo se devuelve el código, nunca la cadena de
  // conexión completa.
  const code = /\b([A-Z][A-Z0-9_]{3,})\b/.exec(db.error)?.[1] ?? "DESCONOCIDO";

  return NextResponse.json(
    {
      app: "ok",
      db: "error",
      codigo: code,
      pista: PISTAS[code] ?? "Revisa las variables DB_HOST, DB_USER, DB_PASSWORD y DB_NAME.",
    },
    { status: 503 },
  );
}

const PISTAS: Record<string, string> = {
  ECONNREFUSED:
    "Nadie responde en ese host y puerto. Revisa DB_HOST y DB_PORT, y que la base admita conexiones desde la aplicacion.",
  ENOTFOUND: "El nombre del servidor no existe. Revisa DB_HOST.",
  ETIMEDOUT:
    "El servidor no contesta a tiempo. Suele ser un cortafuegos que no deja pasar la conexion.",
  ER_ACCESS_DENIED_ERROR: "Usuario o contrasena incorrectos. Revisa DB_USER y DB_PASSWORD.",
  ER_BAD_DB_ERROR: "Esa base de datos no existe. Revisa DB_NAME.",
};
