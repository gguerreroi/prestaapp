import { Router } from "express"
import appAuth from "../../middlewares/auth/app-auth.middleware"
import requirePermission from "../../middlewares/auth/permission.middleware"
import { dbExec } from "../../config/db.query"

const router = Router();

// URL base: /cobranza
router.get('/', appAuth, requirePermission(), (req, res) => {
	res.render('cobranza/cobranza', {
		title: 'Cobranza',
		pageScripts: ['/assets/js/custom/listado-cobranza.js']
	})
})

router.get('/:id', appAuth, requirePermission('/cobranza'), async (req, res) => {
	const { id } = req.params;
	const p = await dbExec("prestamos.sp_prestamo_detalle", { prestamo_id: id })

	res.render('prestamo/prestamo-detalle', {
		title: `Préstamo #${id}`,
		pageScripts: ['/assets/js/custom/prestamo-detalle.js'],
		prestamo: p[0][0],
		plan: p[1],
		totales: p[2][0]
	})
})

export default router;
