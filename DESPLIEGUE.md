# Puesta en producción · GoDaddy Node.js Hosting

Esta aplicación corre en **GoDaddy Node.js Hosting** (el PaaS de `host.godaddy.com/nodejs`),
no en cPanel ni en el Creador de sitios web.

Las reglas de la plataforma están en su contrato público de despliegue:
[godaddy/nodejs-hosting-agent-skill](https://github.com/godaddy/nodejs-hosting-agent-skill).
Ese repositorio trae un validador; conviene pasarlo antes de cada despliegue grande:

```bash
node <ruta-del-skill>/scripts/validate-paas.mjs .
# debe terminar con: OK — ready for Node.js Hosting upload checks.
```

---

## Cómo despliega la plataforma

1. Recibe el código (repositorio de Git conectado, o ZIP subido).
2. Instala **sólo las dependencias de producción** (omite `devDependencies`).
3. Ejecuta `npm run build`.
4. Ejecuta `npm run start`.

De ahí salen los requisitos que este proyecto ya cumple:

| Regla | Cómo se cumple aquí |
|---|---|
| `package.json` con `name`, `version` y `main` (el archivo debe existir) | `main` → `server.js` |
| `scripts.build` y `scripts.start` | `next build` / `next start` |
| Escuchar en `process.env.PORT` | Lo hace Next; `server.js` también |
| Dependencias de ejecución en `dependencies` | `next`, `react`, `mysql2`, … |
| **Sin `.env`** en el despliegue | Está en `.gitignore`; las variables van en el panel |
| Sin `node_modules` | En `.gitignore`; la plataforma instala |
| `.npmrc` con el registro público de npm | En la raíz del proyecto |
| Base de datos con `DB_*` y `mysql2` | `src/lib/db.ts` |

---

## Base de datos

**No hay que crearla ni copiar credenciales.** Cada aplicación de Node.js Hosting
recibe su propia capacidad MySQL, y la plataforma **inyecta sola** estas variables:

```
DB_HOST   DB_PORT   DB_NAME   DB_USER   DB_PASSWORD
```

`src/lib/db.ts` lee exactamente esas cinco. No hay nada que configurar a mano.

> **Red restringida.** Desde la aplicación sólo se puede salir por HTTP (80),
> HTTPS (443) y hacia la MySQL administrada de GoDaddy. Una base de datos externa
> en otro puerto **no es alcanzable**, y esa MySQL tampoco se puede consultar
> desde fuera del hosting.

---

## Variables de entorno

Se capturan **en el panel de Node.js Hosting**, nunca en un archivo del repositorio.

| Variable | Valor |
|---|---|
| `NODE_ENV` | `production` |
| `ADMIN_USER` | `admin` |
| `ADMIN_NAME` | `Administrador` |
| `ADMIN_PASSWORD` | la de `CREDENCIALES.txt` |
| `SESSION_SECRET` | la del apartado 2 de `CREDENCIALES.txt` |
| `SITE_URL` | `https://notyanl.com` (o la URL de vista previa, mientras tanto) |

Las cinco `DB_*` **no se capturan**: las pone la plataforma.

Las tres de `ADMIN_` sólo sirven una vez: crean la cuenta en el primer acceso a
`/admin`. Después las cuentas se administran en `/admin/usuarios`.

---

## Ramas

| Rama | Estado |
|---|---|
| `main` | SQLite. **Pierde las notas y las cuentas en cada despliegue.** No desplegar. |
| `mysql` | Datos en MySQL. Es la que va a producción. |

---

## Comprobar que quedó bien

```
https://TU-URL/api/estado
```

- `{"app":"ok","db":"ok"}` → todo conectado.
- `{"db":"error","codigo":"..."}` → trae la pista de qué variable revisar.

Si ni eso responde, el problema es de arranque: *Acciones rápidas →
**Registros de tiempo de ejecución***.

| Síntoma | Causa habitual |
|---|---|
| `ECONNREFUSED` en `/api/estado` | La MySQL no está aprovisionada todavía |
| `ER_ACCESS_DENIED_ERROR` | Credenciales de base mal inyectadas; reinicia la app |
| Entras a `/admin`, y vuelve al login | Falta HTTPS: la cookie es `secure` |
| «Falta configurar el acceso» | Faltan `ADMIN_PASSWORD` y `SESSION_SECRET` |
| La app no arranca | Mira los registros; suele ser `build` o una variable ausente |

---

## Pendiente de confirmar

**Persistencia de las imágenes subidas.** Las notas, usuarios y banners viven en
MySQL y están a salvo. Las imágenes se escriben en `public/assets/uploads`
(`src/lib/paths.ts`), y la documentación oficial de la plataforma **no dice** qué
partes del disco sobreviven a un redespliegue.

Cómo comprobarlo: sube una nota con portada, vuelve a desplegar, y mira si la
imagen sigue viéndose. Si desaparece, hay que mover las imágenes a la MySQL o a
un almacenamiento externo por HTTPS.

---

## Límites del plan gratuito

Según el FAQ de GoDaddy: **2 aplicaciones en vista previa y 1 publicada**. Las
aplicaciones en vista previa **se eliminan solas a los 30 días**. El producto
está en beta y su interfaz puede cambiar.

---

## Respaldos

Los datos están en la MySQL administrada. Conviene exportarla con cierta
regularidad desde el navegador de base de datos del panel. Las imágenes, mientras
no se aclare su persistencia, conviene conservarlas también en tu computadora.
