# Notas de Actualidad MTY

Sitio de noticias con dos vistas: el **sitio público** (portada, secciones y notas)
y un **panel de administración** donde se cargan las notas desde Word o PDF, se
administra la publicidad, se dan de alta los usuarios y se consultan las
estadísticas.

Todo el estado vive en una sola carpeta (`DATA_DIR`): una base SQLite y los
archivos subidos. No hace falta contratar base de datos ni almacenamiento aparte.

El nombre del sitio, las secciones y la ventana de recomendación se definen en
[`src/lib/config.ts`](src/lib/config.ts). Las redes sociales se configuran desde
el panel, sin tocar código.

---

## Puesta en marcha

```bash
npm install
cp .env.example .env.local     # y edita los valores
npm run dev                    # http://localhost:3000
```

| Variable | Obligatoria | Para qué sirve |
|---|---|---|
| `ADMIN_USER` | No | Usuario de la primera cuenta. Por defecto `admin`. |
| `ADMIN_NAME` | No | Nombre de esa primera cuenta. |
| `ADMIN_PASSWORD` | Sí en producción | Contraseña de la primera cuenta. |
| `SESSION_SECRET` | Sí en producción | Firma la cookie de sesión. Larga y aleatoria. |
| `SITE_URL` | Recomendada | Dirección pública. Alimenta el mapa del sitio, el `robots.txt` y las vistas previas al compartir. |
| `DATA_DIR` | No | Carpeta de datos. Por defecto `./data`. |

Las tres primeras sólo sirven para **sembrar la primera cuenta**: se usan la
primera vez que alguien entra al panel y, en cuanto existe un usuario en la
base, dejan de tener efecto. A partir de ahí las cuentas se administran desde
`/admin/usuarios`.

Para generar el secreto:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

En producción la app se niega a arrancar sin `SESSION_SECRET`, y sin
`ADMIN_PASSWORD` no hay forma de crear la primera cuenta.

---

## Secciones

Portada · Actualidad Mundial · El País · Actualidad Nuevo León · Cultura ·
Espectáculos · Deportes · Ciencia.

Se editan en `CATEGORIES` dentro de [`src/lib/config.ts`](src/lib/config.ts):
cada una tiene nombre completo, nombre corto para la barra de navegación,
descripción y color del distintivo. Agregar o quitar una sección es editar ese
arreglo.

---

## Cómo se usa el panel

Entra a `/admin`.

### Cargar una nota

1. **Cargar documento** → arrastra el `.docx`, `.pdf`, `.txt` o `.html`.
2. La app extrae el **título** y el **cuerpo**, y guarda las **imágenes**
   incrustadas del Word como archivos propios.
3. Ajusta lo que haga falta en el editor: negritas, subtítulos, citas, listas,
   enlaces, imágenes nuevas. El botón **HTML** permite tocar el código directo.
   Pegar con **Shift** inserta texto sin formato.
4. En la columna derecha elige sección, autor, portada y fecha.
5. **Publicar** (o **Guardar como borrador**).

Sobre los formatos:

- **Word (.docx)** da el mejor resultado: conserva títulos, negritas, listas,
  citas y trae las imágenes.
- **PDF** sólo tiene texto, sin estructura real. Se reconstruyen párrafos y
  subtítulos por posición y tamaño de fuente, así que **conviene revisarlo**
  antes de publicar. Un PDF escaneado (imagen) no tiene texto que extraer.
- **.doc** (Word 97-2003) no se puede leer: guárdalo como `.docx`.

Una **fecha de publicación futura** mantiene la nota oculta hasta ese momento.

### Notas recomendadas y archivo

El bloque **“También te puede interesar”** elige al azar entre las notas
publicadas en los **últimos 2 días**. Pasado ese plazo la nota queda
**archivada**: deja de recomendarse, pero sigue disponible por su enlace, en su
sección y en la búsqueda. El plazo es `RECOMMEND_MAX_AGE_DAYS` en
`src/lib/config.ts`.

Las notas se eliminan definitivamente desde **Notas → Editar → Eliminar nota**.

### Usuarios

Cada persona entra con **su propio usuario y contraseña**. Hay dos niveles:

| Rol | Alcance |
|---|---|
| **Administrador** | Todo el panel, incluido dar de alta y baja cuentas. |
| **Editor** | Notas, publicidad y estadísticas. No toca usuarios. |

En **Usuarios** un administrador crea cuentas, cambia permisos, quita el acceso
sin borrar la cuenta, restablece contraseñas y elimina. Cualquiera, sea del rol
que sea, cambia la suya propia en **Mi cuenta**.

Las contraseñas se guardan derivadas con **scrypt** y una sal por usuario: no se
pueden consultar, ni desde el panel ni desde la base. Al crear una cuenta (o al
restablecerla) la contraseña se muestra **una sola vez**; si se deja vacía, el
sistema genera una segura.

Dos reglas que el panel no deja saltarse: siempre debe quedar **al menos un
administrador activo**, y nadie puede desactivar ni borrar su propia cuenta.
Cambiar una contraseña **cierra las sesiones abiertas** de esa cuenta.

### Publicidad

En **Publicidad** se suben los banners. La proporción es **3.75:1**; si la imagen
viene con otra medida se avisa y se recorta centrada.

| Ubicación | Dónde aparece | Medida sugerida |
|---|---|---|
| Superior | Franja bajo el encabezado, en todas las páginas | 1500 × 400 px |
| Costado | Columna lateral de portada, secciones y notas | 750 × 200 px |
| Intercalado | Entre bloques de notas y al pie del cuerpo | 1200 × 320 px |

Cada banner admite enlace, vigencia (desde/hasta) y **peso**: un peso más alto lo
hace aparecer más seguido. Se pueden pausar sin borrarlos; al eliminarlos se
borra también el archivo del disco.

**La rotación es doble**: en cada carga se sortean los banners activos de cada
ubicación (sin repetir dentro de la misma página) y, además, cada hueco va
turnando solo hasta cuatro anunciantes cada 8 segundos, sin recargar. Los
anuncios en espera se pintan ocultos con `display:none`, así que no suman
impresión hasta que de verdad les toca aparecer; en una pestaña de fondo la
rotación se detiene.

### Estadísticas y exportación a Excel

**Estadísticas** muestra, para el rango de fechas que elijas:

- Visitas, páginas vistas y páginas por visita.
- Gráfico de visitas por día.
- Notas más leídas.
- Por banner: vistas, clics y CTR.

El botón **Descargar Excel** genera un `.xlsx` con cinco hojas: *Resumen*,
*Visitas por día*, *Notas*, *Publicidad* y *Publicidad por día*.

Cómo se cuenta:

- Los contadores se disparan **desde el navegador del lector**, no al renderizar,
  así que ni los rastreadores ni las precargas inflan las cifras. Los agentes que
  se identifican como bots se descartan.
- Una **visita** es una sesión: se cierra tras 30 minutos sin actividad.
- Un banner suma **vista** sólo cuando al menos la mitad entra en pantalla, y una
  sola vez por página. El **clic** se cuenta en `/r/[id]`, antes de redirigir al
  anunciante.

### Ajustes

**Ajustes** guarda las direcciones de Facebook, Instagram, TikTok, X, Threads y
WhatsApp. Las que dejes vacías no aparecen. Se muestran en el encabezado y en el
pie del sitio.

---

## Redes sociales y compartir

- **Seguir**: iconos en el encabezado y el pie, con lo configurado en Ajustes.
- **Compartir**: cada nota lleva botones de WhatsApp, Facebook, X, Threads y
  copiar enlace. En celular aparece además **Más**, que abre la hoja de compartir
  del sistema (Instagram, TikTok, correo, mensajes…).

---

## Estructura

```
src/
  app/
    page.tsx                  portada
    seccion/[slug]/           las siete secciones
    nota/[slug]/              nota individual
    buscar/                   búsqueda
    media/[...key]/           sirve los archivos subidos
    r/[id]/                   salida de banners (cuenta el clic y redirige)
    api/hit/                  recibe visitas y vistas de banner del navegador
    admin/
      login/                  acceso (sin protección, por definición)
      (panel)/                todo lo demás, detrás de la sesión
      actions.ts              server actions del panel
  components/
    site/                     encabezado, tarjetas, publicidad, compartir
    admin/                    editor, importador, formularios
  lib/
    config.ts                 sitio, secciones, ubicaciones, proporción del banner
    db.ts                     conexión SQLite + migración del esquema
    storage.ts                capa de archivos
    auth.ts                   sesión firmada con HMAC
    users-shared.ts           roles y tipos de usuario (sirven en cliente)
    sanitize.ts               lista blanca de HTML
    xlsx.ts                   generador de Excel sin dependencias
    importers/                docx · pdf · txt/html
    repo/                     notas · banners · media · estadísticas · ajustes · usuarios
```

La UI nunca habla con SQLite ni con `fs` directamente: pasa por `lib/repo/*` y
`lib/storage.ts`. Para migrar a Postgres o a S3 se cambian esos archivos y nada
más.

---

## Despliegue

Guía paso a paso, con la variante de GoDaddy (cPanel/Passenger) y la de VPS:
**[DESPLIEGUE.md](DESPLIEGUE.md)**.

```bash
npm run build
npm run start        # escucha en $PORT (3000 por defecto)
node server.js       # lo mismo, para hostings que arrancan un archivo Node
```

Requisitos del hosting:

- **Node.js 20 o superior** con procesos persistentes (Plesk, cPanel con Node,
  VPS, Docker). `better-sqlite3` es un módulo nativo: ejecuta `npm install` en el
  servidor para que resuelva el binario correcto.
- **`DATA_DIR` con permisos de escritura**, apuntando **fuera** de la carpeta
  pública (`public_html`), para que nadie pueda descargar la base de datos.
- HTTPS: la cookie de sesión se marca `secure` en producción y no viaja por HTTP.
  Sin certificado no se puede iniciar sesión en el panel.

Este proyecto **no** corre tal cual en Vercel o Netlify: el disco es efímero y
SQLite y los archivos subidos se perderían. Para ese camino habría que sustituir
`lib/db.ts` por Postgres/Turso y `lib/storage.ts` por Blob/S3.

### Respaldos

Copiar la carpeta `DATA_DIR` completa: contiene `notyac.db` (con `notyac.db-wal`)
y `uploads/`.

---

## Notas técnicas

- El cuerpo de las notas se filtra contra una lista blanca antes de guardarse
  (`lib/sanitize.ts`): no sobreviven `<script>`, atributos `on*` ni enlaces
  `javascript:`.
- Las rutas de archivos se validan contra traversal antes de tocar el disco.
- Toda página del panel cuelga de `admin/(panel)/layout.tsx`, que exige sesión, y
  cada server action vuelve a verificarla por su cuenta. La cookie sólo guarda
  quién eres: el rol se lee de la base en cada petición, así que quitarle los
  permisos a alguien surte efecto de inmediato.
- Las fechas se interpretan siempre en horario de México
  (`America/Mexico_City`), sin importar la zona horaria del servidor.
- El diseño es responsivo: una sola columna en celular, con la barra de secciones
  desplazable y los banners manteniendo su proporción.
