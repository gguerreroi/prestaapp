import { Router } from "express"
import requireSessionAuth from "../../middlewares/auth/requireSessionAuth.middleware"

const router = Router();

router.get('/nuevo', requireSessionAuth, (req, res)=> {
	res.render('prestamo/prestamo-nuevo', {
		title: 'Nuevo Préstamo',
		pageScripts: ['/assets/js/custom/nuevo-prestamo.js']
	})
})

export default router;

