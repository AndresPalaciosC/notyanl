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

  // El código lo da el driver (err.code): es una constante del protocolo y no
  // revela servidor ni usuario. El mensaje completo no se devuelve nunca.
  const code = db.code;

  return NextResponse.json(
    {
      app: "ok",
      db: "error",
      codigo: code,
      pista:
        PISTAS[code] ??
        "Error no catalogado. Revisa los Registros de tiempo de ejecucion del panel.",
    },
    { status: 503 },
  );
}

const PISTAS: Record<string, string> = {
  SIN_CONFIGURACION:
    "La aplicacion no recibe las variables de la base. Comprueba que esta app tenga aprovisionada su MySQL en Configuracion > Base de datos alojada, y reinicia.",
  ECONNREFUSED:
    "Nadie responde en ese host y puerto. Revisa DB_HOST y DB_PORT, y que la base admita conexiones desde la aplicacion.",
  ENOTFOUND: "El nombre del servidor no existe. Revisa DB_HOST.",
  ETIMEDOUT:
    "El servidor no contesta a tiempo. Suele ser un cortafuegos que no deja pasar la conexion.",
  ER_ACCESS_DENIED_ERROR:
    "Credenciales rechazadas. En Node.js Hosting las inyecta la plataforma: revisa que no haya un DATABASE_URL ni variables DB_* puestas a mano en Secretos.",
  ER_BAD_DB_ERROR: "Esa base de datos no existe. Revisa DB_NAME.",
  ER_TABLEACCESS_DENIED_ERROR:
    "Conecta, pero el usuario no puede crear tablas. Importa el esquema con 'Importar SQL' del panel.",
  ER_DBACCESS_DENIED_ERROR:
    "Conecta, pero no tiene permisos sobre la base. Importa el esquema desde el panel.",
  ER_CON_COUNT_ERROR:
    "Demasiadas conexiones a la vez. Baja DB_POOL_SIZE o quitalo para usar el valor por omision.",
  PROTOCOL_CONNECTION_LOST:
    "La base cerro una conexion ociosa. Suele ser pasajero: vuelve a cargar.",
  ECONNRESET: "La base cerro la conexion. Suele ser pasajero: vuelve a cargar.",
  ER_SECURE_TRANSPORT_REQUIRED:
    "El servidor exige conexion cifrada. Hay que anadir la opcion ssl al pool en lib/db.ts.",
  HANDSHAKE_NO_SSL_SUPPORT:
    "Se pidio conexion cifrada y el servidor no la ofrece. Hay que quitar la opcion ssl del pool.",
};
