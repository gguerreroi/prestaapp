import { Router } from "express"
import requireApiAuth from "../../middlewares/auth/requireApiAuth.middleware"
import {getCustomerByCui9} from "./bycui9.clientes.api.controller";

const router = Router();

router.get("/:cui9", requireApiAuth, getCustomerByCui9)

export default router;
