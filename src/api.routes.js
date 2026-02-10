import { Router } from "express"
import auth from "./modules/auth/auth.api.routes"
import prestamo from "./modules/prestamo/prestamo.api.routes"
import clientes from "./modules/clientes/clientes.api.routes"
import ui from "./modules/ui/ui.api.routes"

const router = Router();

router.use("/auth", auth)
router.use("/prestamo", prestamo)
router.use("/clientes", clientes)
router.use("/ui", ui)

export default router;