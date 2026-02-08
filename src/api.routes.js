import { Router } from "express"
import auth from "./modules/auth/auth.api.routes"
const router = Router();

router.use("/auth", auth)

export default router;