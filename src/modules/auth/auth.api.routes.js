import { Router } from "express"
import {auth, logout} from "./auth.route.controller"

// import getInfo from "../../middlewares/auth/getInfo"

const router = Router();
// URL: /api/auth/

router.post("/", auth)
router.get("/logout", logout)

export default router;