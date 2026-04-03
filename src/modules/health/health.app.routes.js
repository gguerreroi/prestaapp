import { Router } from "express";

const router = Router();

// URL base: /health
router.get("/", (req, res) => {
  res.status(200).send("OK");
});

export default router;
