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

const router: Router = Router();

const API = "/api/v1";

router.use(`${API}/auth`, authRoutes);
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
