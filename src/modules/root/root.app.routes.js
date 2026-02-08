import { Router } from "express"
import requireSessionAuth from "../../middlewares/auth/requireSessionAuth.middleware"

const router = Router();

router.get('/', requireSessionAuth, (req, res)=> {
	res.render('home/dashboard.ejs', {
		title: 'Inicio'
	})
})

export default router;

