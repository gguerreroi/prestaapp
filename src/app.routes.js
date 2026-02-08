import { Router } from "express"
import root from "./modules/root/root.app.routes"
import prestamos from "./modules/prestamo/prestamo.app.routes"
const app = Router();

app.use(root)
app.use("/prestamos", prestamos);

export default app;