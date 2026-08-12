import { Router } from "express";
import { AuditController } from "../controllers/audit.controller";
import { authenticate } from "../middlewares/auth.middleware";

const router = Router();

router.get("/", authenticate, AuditController.list);

export const auditRoutes = router;
