import { Router } from "express"
import requireApiAuth from "../../middlewares/auth/requireApiAuth.middleware"
import { listadoCobranza } from "./listado.cobranza.api.controller"

const router = Router();

router.get('/listado', requireApiAuth, listadoCobranza);

export default router;
