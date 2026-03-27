import { Router } from "express"
import apiAuth from "../../middlewares/auth/api-auth.middleware"
import {getCustomerByCui9} from "./bycui9.clientes.api.controller";

const router = Router();

router.get("/:cui9", apiAuth, getCustomerByCui9)

export default router;
