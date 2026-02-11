import { Router } from "express"

import {select2} from "./select2.api.controller";
import { datatables } from "./datatables.api.controller";
import requireApiAuth from "../../middlewares/auth/requireApiAuth.middleware";

const router = Router();

router.get('/select2/:view', requireApiAuth, select2);
router.get('/datatables/:view', requireApiAuth, datatables);

export default router;