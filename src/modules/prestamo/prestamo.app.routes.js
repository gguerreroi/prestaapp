import { Router } from "express"
import requireSessionAuth from "../../middlewares/auth/requireSessionAuth.middleware"
import getInfo from "../../middlewares/auth/getInfo"

const router = Router();

router.get('/nuevo', requireSessionAuth, (req, res)=> {
	const a = getInfo(req)
	res.render('prestamo/prestamo-nuevo', a)
})

export default router;

