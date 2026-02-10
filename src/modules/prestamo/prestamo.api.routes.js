import { Router } from "express"
import requireApiAuth from "../../middlewares/auth/requireApiAuth.middleware"
import { createLoan } from "./nuevo.prestamo.api.controller";

const router = Router();

router.post('/nuevo', requireApiAuth, createLoan)

export default router;