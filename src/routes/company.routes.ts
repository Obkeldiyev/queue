import { Router } from "express";
import { CompanyController } from "../controllers/company.controller";
import { authenticate, requireCompanyAdmin, requirePlatformAdmin } from "../middlewares/auth.middleware";

const router = Router();

// Subscription plans (public read, platform admin write)
router.get("/subscriptions", CompanyController.listSubscriptions);
router.post("/subscriptions", authenticate, requirePlatformAdmin, CompanyController.createSubscription);

// Company management
router.get("/", authenticate, requirePlatformAdmin, CompanyController.list);
router.post("/", authenticate, requirePlatformAdmin, CompanyController.create);
router.get("/:id", authenticate, requireCompanyAdmin, CompanyController.findOne);
router.patch("/:id", authenticate, requireCompanyAdmin, CompanyController.update);
router.delete("/:id", authenticate, requirePlatformAdmin, CompanyController.remove);
router.post("/:id/subscription", authenticate, requirePlatformAdmin, CompanyController.assignSubscription);

export const companyRoutes = router;
