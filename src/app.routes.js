import { Router } from "express"
import root from "./modules/root/root.app.routes"
import prestamos from "./modules/prestamo/prestamo.app.routes"
import clientes from "./modules/clientes/clientes.app.routes"

const app = Router();

app.use(root)
app.use("/prestamos", prestamos);
app.use("/clientes", clientes);

export default app;