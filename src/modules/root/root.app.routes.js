import { Router } from "express"
import appAuth from "../../middlewares/auth/app-auth.middleware"

const router = Router();

router.get('/', appAuth, (req, res)=> {
	res.render('home/dashboard.ejs', {
		title: 'Inicio'
	})
})

export default router;

