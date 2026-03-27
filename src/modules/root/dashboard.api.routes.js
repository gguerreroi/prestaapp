import { Router } from "express"
import apiAuth from "../../middlewares/auth/api-auth.middleware"
import { dashboardStats } from "./dashboard.api.controller"

const router = Router();

router.get('/stats', apiAuth, dashboardStats)

export default router;
