import { Router } from "express"
import auth from "./modules/auth/auth.api.routes"
import prestamo from "./modules/prestamo/prestamo.api.routes"
import clientes from "./modules/clientes/clientes.api.routes"
import ui from "./modules/ui/ui.api.routes"
import cobranza from "./modules/cobranza/cobranza.api.routes"
import dashboard from "./modules/root/dashboard.api.routes"

const router = Router();

router.use("/auth", auth)
router.use("/dashboard", dashboard)
router.use("/prestamo", prestamo)
router.use("/clientes", clientes)
router.use("/ui", ui)
router.use("/cobranza", cobranza)

export default router;