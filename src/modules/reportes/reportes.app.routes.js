import { Router } from "express"
import requireSessionAuth from "../../middlewares/auth/requireSessionAuth.middleware"

const router = Router();
// URL base: /reportes
router.get('/', requireSessionAuth, (req, res)=> {
	res.render('reportes/reportes', {
		title: 'Reportes'
	})
})

export default router;
