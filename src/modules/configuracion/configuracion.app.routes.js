import { Router } from "express"
import appAuth from "../../middlewares/auth/app-auth.middleware"
import requirePermission from "../../middlewares/auth/permission.middleware"

const router = Router();

// URL base: /configuracion
router.get('/', appAuth, requirePermission('/configuracion'), (req, res) => {
	res.render('configuracion/configuracion', {
		title: 'Configuracion'
	})
})

router.get('/cobros-administrativos', appAuth, requirePermission('/configuracion'), (req, res) => {
	res.render('configuracion/cobros-administrativos', {
		title: 'Cobros Administrativos',
		pageScripts: ['/assets/js/custom/cobros-administrativos.js']
	})
})

export default router;
