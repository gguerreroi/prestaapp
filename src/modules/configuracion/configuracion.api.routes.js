import { Router } from "express"
import apiAuth from "../../middlewares/auth/api-auth.middleware"
import requirePermission from "../../middlewares/auth/permission.middleware"
import { listarCobros, crearCobro, editarCobro, eliminarCobro } from "./cobros-admon.api.controller"

const router = Router();

router.get('/cobros-administrativos', apiAuth, requirePermission('/configuracion', { isApi: true }), listarCobros)
router.post('/cobros-administrativos', apiAuth, requirePermission('/configuracion', { isApi: true }), crearCobro)
router.put('/cobros-administrativos/:id', apiAuth, requirePermission('/configuracion', { isApi: true }), editarCobro)
router.delete('/cobros-administrativos/:id', apiAuth, requirePermission('/configuracion', { isApi: true }), eliminarCobro)

export default router;
