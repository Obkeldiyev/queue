import { Router } from "express";
import KioskController from "../controllers/kiosk.controller";

const router = Router();

// Build and download a preconfigured kiosk ZIP (template EXE + kiosk-config.json)
router.post("/build", KioskController.buildKiosk);

export const kioskRoutes = router;
