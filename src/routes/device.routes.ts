import { Router } from "express";
import { DeviceController } from "../controllers/device.controller";
import { authenticate, requireCompanyAdmin } from "../middlewares/auth.middleware";

const router = Router();

router.post("/:id/heartbeat", DeviceController.heartbeat); // Devices call this without user JWT
router.get("/", authenticate, requireCompanyAdmin, DeviceController.list);
router.post("/", authenticate, requireCompanyAdmin, DeviceController.create);
router.get("/:id", DeviceController.findOne);              // Public: kiosk polls its own settings
router.patch("/:id", authenticate, requireCompanyAdmin, DeviceController.update);
router.delete("/:id", authenticate, requireCompanyAdmin, DeviceController.remove);

export const deviceRoutes = router;
