import { Router } from "express"

import {select2} from "./select2.api.controller";
import { datatables } from "./datatables.api.controller";
import apiAuth from "../../middlewares/auth/api-auth.middleware";

const router = Router();

router.get('/select2/:view', apiAuth, select2);
router.get('/datatables/:view', apiAuth, datatables);

export default router;