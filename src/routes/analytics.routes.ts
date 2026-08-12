import { Router } from "express";
import { AnalyticsController } from "../controllers/analytics.controller";
import { authenticate } from "../middlewares/auth.middleware";

const router = Router();

router.get("/dashboard", authenticate, AnalyticsController.dashboard);
router.get("/snapshots", authenticate, AnalyticsController.snapshots);
router.post("/snapshots/generate", authenticate, AnalyticsController.generateSnapshot);
router.get("/operator/:id", authenticate, AnalyticsController.operatorStats);

export const analyticsRoutes = router;
