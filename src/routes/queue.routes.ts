import { Router } from "express";
import { QueueController } from "../controllers/queue.controller";
import { authenticate, requireCompanyAdmin, requireCompanyUser } from "../middlewares/auth.middleware";

const router = Router();

// Ticket operations (kiosk + operator)
router.get("/tickets/list", QueueController.listTickets);             // Public: kiosk reads waiting counts
router.post("/tickets/issue", QueueController.issueTicket);           // Public: kiosk / online
router.post("/tickets/call-next", authenticate, requireCompanyUser, QueueController.callNext);
router.post('/tickets/:id/assign', authenticate, requireCompanyAdmin, QueueController.assignTicket);
router.get("/tickets/:id", authenticate, requireCompanyUser, QueueController.findOneTicket);
router.patch("/tickets/:id/complete", authenticate, requireCompanyUser, QueueController.completeTicket);
router.patch("/tickets/:id/serve", authenticate, requireCompanyUser, QueueController.serveTicket);
router.patch("/tickets/:id/recall", authenticate, requireCompanyUser, QueueController.recallTicket);
router.patch("/tickets/:id/no-show", authenticate, requireCompanyUser, QueueController.noShow);
router.patch("/tickets/:id/cancel", QueueController.cancelTicket);    // Customer can cancel own
router.patch("/tickets/:id/transfer", authenticate, requireCompanyUser, QueueController.transferTicket);

// Queue Groups
router.get("/", QueueController.listGroups);                          // Public: kiosk reads active queues
router.post("/", authenticate, requireCompanyAdmin, QueueController.createGroup);
router.get("/:id", authenticate, requireCompanyAdmin, QueueController.findOneGroup);
router.patch("/:id", authenticate, requireCompanyAdmin, QueueController.updateGroup);
router.delete("/:id", authenticate, requireCompanyAdmin, QueueController.removeGroup);

export const queueRoutes = router;
