import { Router } from "express";
import apiAuth from "../../middlewares/auth/api-auth.middleware";
import requirePermission from "../../middlewares/auth/permission.middleware";
import { createLoan } from "./nuevo.prestamo.api.controller";
import { registrarPago } from "./pagos.prestamo.api.controller";
import { reversarPago } from "./reversarPago.api.controller";

const router = Router();
// Base URL: /api/prestamos
router.post(
  "/nuevo",
  apiAuth,
  requirePermission("/prestamos", { isApi: true }),
  createLoan,
);

router.post("/:id", apiAuth, registrarPago);
router.delete("/:id", apiAuth, reversarPago);

export default router;
