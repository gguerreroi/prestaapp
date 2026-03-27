import { Router } from "express"
import requireSessionAuth from "../../middlewares/auth/requireSessionAuth.middleware"

const router = Router();

// URL base: /cobranza
router.get('/', requireSessionAuth, (req, res) => {
	res.render('cobranza/cobranza', {
		title: 'Cobranza',
		pageScripts: ['/assets/js/custom/listado-cobranza.js']
	})
})

export default router;
