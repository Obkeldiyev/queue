import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";
import { authenticate } from "../middlewares/auth.middleware";

const router = Router();

router.post("/platform/register", AuthController.registerPlatformUser);
router.post("/platform/login", AuthController.platformLogin);
router.post("/company/login", AuthController.companyLogin);
router.post("/refresh", AuthController.refresh);
router.post("/logout", AuthController.logout);
router.get("/me", authenticate, AuthController.me);

export const authRoutes = router;
