import { Router } from "express"
import requireSessionAuth from "../../middlewares/auth/requireSessionAuth.middleware"
import { dbExec } from "../../config/db.query"

const router = Router();
// URL base: /prestamos
router.get('/nuevo', requireSessionAuth, (req, res)=> {
	res.render('prestamo/prestamo-nuevo', {
		pageScripts: ['/assets/js/custom/nuevo-prestamo.js']
	})
})

router.get('/:id', requireSessionAuth, async (req, res)=> {
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

router.get('/', requireSessionAuth, (req, res)=> {
	res.render('prestamo/prestamos', {
		pageScripts: ['/assets/js/custom/listado-prestamo.js']
	})
})

export default router;