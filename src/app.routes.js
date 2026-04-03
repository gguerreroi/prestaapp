import { Router } from "express";
import root from "./modules/root/root.app.routes";
import prestamos from "./modules/prestamo/prestamo.app.routes";
import clientes from "./modules/clientes/clientes.app.routes";
import reportes from "./modules/reportes/reportes.app.routes";
import cobranza from "./modules/cobranza/cobranza.app.routes";
import configuracion from "./modules/configuracion/configuracion.app.routes";
import health from "./modules/health/health.app.routes";

const app = Router();

app.use(root);
app.use("/prestamos", prestamos);
app.use("/clientes", clientes);
app.use("/reportes", reportes);
app.use("/cobranza", cobranza);
app.use("/configuracion", configuracion);
app.use("/health", health);

export default app;
