/**
 * Arranque para hospedajes que ejecutan un archivo Node (cPanel/Passenger de
 * GoDaddy, Plesk, PM2, Docker). Levanta exactamente la misma aplicacion que
 * `npm run start`, pero por el puerto que le indique el hosting.
 *
 * Este archivo NO pasa por el compilador de Next: se escribe en CommonJS y en
 * sintaxis que entienda el Node del servidor (20 o superior).
 */

const { createServer } = require("node:http");
const next = require("next");

const port = parseInt(process.env.PORT || "3000", 10);
// Passenger arranca sin NODE_ENV: aqui se da por hecho que esto es produccion.
process.env.NODE_ENV = process.env.NODE_ENV || "production";

const app = next({ dev: false });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    createServer((req, res) => {
      handle(req, res);
    }).listen(port, () => {
      console.log(`Notas de Actualidad MTY escuchando en el puerto ${port}`);
    });
  })
  .catch((error) => {
    console.error("No se pudo arrancar la aplicacion:", error);
    process.exit(1);
  });
