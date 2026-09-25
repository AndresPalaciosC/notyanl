# Puesta en producción en GoDaddy

Esta aplicación es un servidor Node, no un sitio de archivos estáticos. Guarda
las notas, la publicidad y las estadísticas en una base SQLite y en archivos
dentro de una carpeta propia (`DATA_DIR`).

---

## Punto de partida (septiembre 2026)

En la cuenta de GoDaddy hay hoy:

| Producto | Sirve para esto |
|---|---|
| Dominio `notyanl.com` (hasta sep 2027) | Sí, se conserva tal cual |
| Certificado SSL | Sí |
| **Creador de sitios web (Website Builder)** | **No.** Hay que sustituirlo |

Website Builder es un producto cerrado: se arman páginas arrastrando bloques y
las sirve GoDaddy. No admite subir código ni ejecutar un proceso Node, y no
trae cPanel. Por eso hace falta contratar **hosting Linux con cPanel y Node**.

El registro DNS de hoy lo confirma:

```
A   @   →   WebsiteBuilder Site
```

Ese renglón es el que cambiará al final, para que el dominio apunte al hosting
nuevo en lugar del creador de páginas.

---

## Paso 0. Antes de pagar, confirma que el plan corre Node

**No compres sin preguntar.** Los planes de GoDaddy cambian de nombre y de
características seguido. Entra al chat de soporte (en español) y pregunta
textualmente:

> "Quiero contratar hosting web Linux. Necesito correr una aplicación Node.js
> versión 20 o superior, con un proceso permanente. ¿Qué plan incluye
> **Setup Node.js App** en cPanel y acceso a **Terminal** o SSH?"

Que te lo confirmen **antes** de pagar. Si dudan, no compres: un plan sin Node
no puede correr este sitio y tendrías que pedir reembolso.

Pide además que el hosting quede asignado al dominio `notyanl.com`.

### Al terminar la compra

Al asignar el dominio al hosting nuevo, GoDaddy suele actualizar el registro
`A` solo. Si no lo hace, hay que editarlo a mano (DNS → el renglón `A` con
nombre `@`) y poner la IP del hosting, que aparece en cPanel bajo
*Información general → Dirección IP compartida*.

En cuanto ese registro deje de apuntar a **WebsiteBuilder Site**, la página
actual del creador deja de verse en `notyanl.com`. Es lo esperado: la
sustituye el sitio de noticias. El cambio tarda de minutos a un par de horas en
propagarse.

Una vez migrado, se puede **cancelar la suscripción de Website Builder** para
dejar de pagarla.

---

## Opción A · cPanel con Node.js (Passenger)

### 1. Sube el código

Ya está preparado el archivo **`notyac-para-subir.zip`** en la carpeta del
proyecto. Trae sólo lo que el servidor necesita: no lleva dependencias, ni
compilado, ni la base local, ni `CREDENCIALES.txt`, ni `.env.local`. Esos dos
últimos **no deben salir de tu computadora**.

En cPanel → **Administrador de archivos**:

1. Entra a la carpeta `/home/TU-USUARIO` (la raíz, **no** `public_html`).
2. **Cargar** → elige `notyac-para-subir.zip`.
3. Al terminar, clic derecho sobre el archivo → **Extraer**.
4. Deja el contenido en una carpeta llamada `notyac`.

Debe quedar así: `/home/TU-USUARIO/notyac/package.json`, `.../notyac/server.js`,
`.../notyac/src/`.

Va fuera de `public_html` a propósito: ahí dentro los archivos se pueden
descargar desde internet, y ahí van a vivir la base de datos y las notas.

### 2. Crea la aplicación Node

En cPanel → **Setup Node.js App** → *Create Application*:

| Campo | Valor |
|---|---|
| Node.js version | La más alta disponible (**20 o superior**) |
| Application mode | `Production` |
| Application root | `notyac` |
| Application URL | tu dominio |
| Application startup file | `server.js` |

Guarda. cPanel crea un entorno virtual y te muestra arriba una línea
`source /home/.../bin/activate` — cópiala, la necesitas en el paso 4.

### 3. Carpeta de datos

En el *Administrador de archivos* crea `/home/USUARIO/notyac-datos`, **fuera de
`public_html`**. Ahí van la base y las imágenes; si estuviera dentro de la
carpeta pública, cualquiera podría descargar la base de datos.

### 4. Variables de entorno

En la misma pantalla de *Setup Node.js App*, sección **Environment variables**,
agrega:

| Nombre | Valor |
|---|---|
| `NODE_ENV` | `production` |
| `ADMIN_USER` | `admin` |
| `ADMIN_NAME` | `Administrador` |
| `ADMIN_PASSWORD` | la de `CREDENCIALES.txt` |
| `SESSION_SECRET` | la del apartado 2 de `CREDENCIALES.txt` |
| `SITE_URL` | `https://notyanl.com` |
| `DATA_DIR` | `/home/USUARIO/notyac-datos` |

### 5. Instala y compila

Abre **Terminal** en cPanel (o SSH), pega la línea `source .../activate` del
paso 2 y luego:

```bash
cd ~/notyac
npm install          # compila better-sqlite3 para el Node del servidor
npm run build
```

`npm install` en el servidor es **obligatorio**: `better-sqlite3` es un módulo
nativo y el binario de Windows no funciona en Linux.

### 6. Arranca

Vuelve a *Setup Node.js App* y pulsa **Restart**. Entra a `https://tu-dominio`.

### 7. HTTPS

cPanel → **SSL/TLS Status** → activa el certificado gratuito y **Force HTTPS
Redirect**. Es necesario: la cookie del panel se marca `secure` en producción y
no viaja por HTTP, así que sin certificado **no vas a poder iniciar sesión**.

### 8. Primer acceso

Entra a `https://tu-dominio/admin` con el usuario y la contraseña de
`CREDENCIALES.txt`. Esa primera entrada crea la cuenta en la base.

Lo primero que hay que hacer: **cambiar la contraseña** en
*Usuarios → Mi cuenta*, y dar de alta al resto del equipo.

---

## Opción B · VPS o servidor propio

```bash
git clone <repositorio> /var/www/notyac
cd /var/www/notyac
npm install
npm run build

cat > .env <<'FIN'
NODE_ENV=production
ADMIN_USER=admin
ADMIN_NAME=Administrador
ADMIN_PASSWORD=...
SESSION_SECRET=...
SITE_URL=https://notyanl.com
DATA_DIR=/var/lib/notyac
FIN

mkdir -p /var/lib/notyac
```

Con PM2, para que reviva solo tras un reinicio:

```bash
npm install -g pm2
pm2 start server.js --name notyac
pm2 save && pm2 startup
```

Delante conviene un Nginx que termine el HTTPS y haga `proxy_pass` al puerto
3000.

---

## Después de publicar

### Respaldos

Todo el estado vive en una sola carpeta. Respaldar es copiar `DATA_DIR`
completo (`notyac.db`, `notyac.db-wal` y `uploads/`). Vale la pena dejarlo en
un cron diario.

### Actualizar el sitio

```bash
cd ~/notyac
git pull
npm install
npm run build
# y Restart en cPanel, o `pm2 restart notyac`
```

`DATA_DIR` no se toca al actualizar: las notas y la publicidad se conservan.

### Publicidad

*Publicidad* en el panel. Proporción **3.75:1**:

| Ubicación | Medida sugerida |
|---|---|
| Superior | 1500 × 400 px |
| Costado | 750 × 200 px |
| Intercalado | 1200 × 320 px |

Cada hueco va turnando solo los anuncios que le tocan, cada 8 segundos. El peso
hace que un anunciante salga más seguido, y las vistas y clics se ven en
*Estadísticas*.

---

## Si algo falla

| Síntoma | Causa habitual |
|---|---|
| Entras a `/admin`, pones la contraseña y vuelve al login | Falta HTTPS. La cookie es `secure` y no viaja por HTTP. |
| «Falta configurar el acceso» | No están `ADMIN_PASSWORD` y `SESSION_SECRET` en las variables de entorno. |
| Error de `better-sqlite3` al arrancar | Falta `npm install` **en el servidor**, o el Node es menor que 20. |
| «Could not find a production build» | Falta `npm run build`. |
| Se suben imágenes pero no se ven | `DATA_DIR` sin permisos de escritura, o apunta a una carpeta que no existe. |
| Se perdieron las notas tras actualizar | `DATA_DIR` no estaba definido y se usó `./data`, que se borra al redesplegar. |
