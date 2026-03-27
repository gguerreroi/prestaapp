import { Router } from "express"
import apiAuth from "../../middlewares/auth/api-auth.middleware"
import { createLoan } from "./nuevo.prestamo.api.controller";
import { registrarPago } from "./pagos.prestamo.api.controller";

const router = Router();
// Base URL: /api/prestamos
router.post('/nuevo', apiAuth, createLoan)
router.post('/:id', apiAuth, registrarPago)

export default router;