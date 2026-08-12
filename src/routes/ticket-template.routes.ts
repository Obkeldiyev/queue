import { Router } from "express";
import { TicketTemplateController } from "../controllers/ticket-template.controller";
import { authenticate, requireCompanyAdmin } from "../middlewares/auth.middleware";

const router = Router();

router.get("/", authenticate, requireCompanyAdmin, TicketTemplateController.list);
router.post("/", authenticate, requireCompanyAdmin, TicketTemplateController.create);
router.get("/:id", authenticate, requireCompanyAdmin, TicketTemplateController.findOne);
router.patch("/:id", authenticate, requireCompanyAdmin, TicketTemplateController.update);
router.delete("/:id", authenticate, requireCompanyAdmin, TicketTemplateController.remove);

export const ticketTemplateRoutes = router;
