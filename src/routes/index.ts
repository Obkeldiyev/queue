import { Router } from "express";
import { authRoutes } from "./auth.routes";
import { companyRoutes } from "./company.routes";
import { branchRoutes } from "./branch.routes";
import { serviceRoutes } from "./service.routes";
import { queueRoutes } from "./queue.routes";
import { counterRoutes } from "./counter.routes";
import { employeeRoutes } from "./employee.routes";
import { deviceRoutes } from "./device.routes";
import { kioskRoutes } from "./kiosk.routes";
import { menuRoutes } from "./menu.routes";
import { pageRoutes } from "./page.routes";
import { ticketTemplateRoutes } from "./ticket-template.routes";
import { orderRoutes } from "./order.routes";
import { analyticsRoutes } from "./analytics.routes";
import { auditRoutes } from "./audit.routes";
import { operationsRoutes } from "./operations.routes";
import { broadcast } from "../utils/websocket";
import type { AuthRequest } from "../middlewares/auth.middleware";

const router: Router = Router();

const API = "/api/v1";

// Notify subscribed clients after a successful configuration mutation.
router.use((req: AuthRequest, res, next) => {
  res.on("finish", () => {
    const requestPath = req.originalUrl.split("?")[0];
    const resource = requestPath.split("/")[3];
    if (!["POST", "PATCH", "DELETE", "PUT"].includes(req.method) || res.statusCode >= 400) return;
    if (!["devices", "menus", "pages", "ticket-templates", "services", "queues", "counters", "employees", "branches", "companies"].includes(resource)) return;
    if (requestPath.includes("/tickets/") || requestPath.endsWith("/heartbeat")) return;
    const companyId = req.user?.companyId || req.body?.company_id;
    if (companyId) broadcast({ event: "resource:changed", companyId, payload: { resource, id: req.params.id } });
  });
  next();
});

router.use(`${API}/auth`, authRoutes);
router.use(`${API}/operations`, operationsRoutes);
router.use(`${API}/companies`, companyRoutes);
router.use(`${API}/branches`, branchRoutes);
router.use(`${API}/services`, serviceRoutes);
router.use(`${API}/queues`, queueRoutes);
router.use(`${API}/counters`, counterRoutes);
router.use(`${API}/employees`, employeeRoutes);
router.use(`${API}/devices`, deviceRoutes);
router.use(`${API}/kiosk`, kioskRoutes);
router.use(`${API}/menus`, menuRoutes);
router.use(`${API}/pages`, pageRoutes);
router.use(`${API}/ticket-templates`, ticketTemplateRoutes);
router.use(`${API}/orders`, orderRoutes);
router.use(`${API}/analytics`, analyticsRoutes);
router.use(`${API}/audit-logs`, auditRoutes);

// Health check
router.get(`${API}/health`, (_req, res) => {
  res.json({ success: true, message: "QMS API v1 running", time: new Date().toISOString() });
});

export default router;
