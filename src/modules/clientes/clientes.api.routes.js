import { Router } from "express";
import apiAuth from "../../middlewares/auth/api-auth.middleware";
import requirePermission from "../../middlewares/auth/permission.middleware";
import { getCustomerByCui9 } from "./bycui9.clientes.api.controller";
import { editCustomer } from "./edit.clientes.api.controller";

const router = Router();

router.get(
  "/:cui9",
  apiAuth,
  requirePermission("/clientes", { isApi: true }),
  getCustomerByCui9,
);

router.put(
  "/:cui9",
  apiAuth,
  requirePermission("/clientes", { isApi: true }),
  editCustomer,
);

export default router;
