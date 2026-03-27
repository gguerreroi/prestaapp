import { Router } from "express"
import appAuth from "../../middlewares/auth/app-auth.middleware"
import { dbExec } from "../../config/db.query"

const router = Router();
// URL base: /prestamos
router.get('/nuevo', appAuth, (req, res)=> {
	res.render('prestamo/prestamo-nuevo', {
		pageScripts: ['/assets/js/custom/nuevo-prestamo.js']
	})
})

router.get('/:id', appAuth, async (req, res)=> {
	const { id } = req.params;
	const p = await dbExec("prestamos.sp_prestamo_detalle", {prestamo_id: id })

	res.render('prestamo/prestamo-detalle', {
		title: `Préstamo #${id}`,
		pageScripts: ['/assets/js/custom/prestamo-detalle.js'],
		prestamo: p[0][0],
		plan: p[1],
		totales: p[2][0]
	})
})

router.get('/', appAuth, (req, res)=> {
	res.render('prestamo/prestamos', {
		pageScripts: ['/assets/js/custom/listado-prestamo.js']
	})
})

export default router;