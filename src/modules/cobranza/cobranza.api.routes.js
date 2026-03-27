import { Router } from "express"
import requireApiAuth from "../../middlewares/auth/api-auth.middleware"
import requirePermission from "../../middlewares/auth/permission.middleware"
import { listadoCobranza } from "./listado.cobranza.api.controller"

const router = Router();

router.get('/listado', requireApiAuth, requirePermission('/cobranza', { isApi: true }), listadoCobranza);

export default router;
