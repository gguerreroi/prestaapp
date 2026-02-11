import { Router } from "express"
import requireApiAuth from "../../middlewares/auth/requireApiAuth.middleware"
import { createLoan } from "./nuevo.prestamo.api.controller";
import { registrarPago } from "./pagos.prestamo.api.controller";

const router = Router();
// Base URL: /api/prestamos
router.post('/nuevo', requireApiAuth, createLoan)
router.post('/:id', requireApiAuth, registrarPago)

export default router;