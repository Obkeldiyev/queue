import { Router } from "express";
import { ServiceController } from "../controllers/service.controller";
import { authenticate, requireCompanyAdmin } from "../middlewares/auth.middleware";

const router = Router();

router.get("/", authenticate, requireCompanyAdmin, ServiceController.list);
router.post("/", authenticate, requireCompanyAdmin, ServiceController.create);
router.get("/:id", authenticate, requireCompanyAdmin, ServiceController.findOne);
router.patch("/:id", authenticate, requireCompanyAdmin, ServiceController.update);
router.delete("/:id", authenticate, requireCompanyAdmin, ServiceController.remove);

export const serviceRoutes = router;
