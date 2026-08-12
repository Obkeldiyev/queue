import { Router } from "express";
import { CounterController } from "../controllers/counter.controller";
import { authenticate, requireCompanyAdmin, requireCompanyUser } from "../middlewares/auth.middleware";

const router = Router();

// Sessions
router.post("/sessions/open", authenticate, requireCompanyUser, CounterController.openSession);
router.post("/sessions/close", authenticate, requireCompanyUser, CounterController.closeSession);

router.get("/", authenticate, requireCompanyUser, CounterController.list);
router.post("/", authenticate, requireCompanyAdmin, CounterController.create);
router.get("/:id", authenticate, requireCompanyUser, CounterController.findOne);
router.patch("/:id", authenticate, requireCompanyAdmin, CounterController.update);
router.delete("/:id", authenticate, requireCompanyAdmin, CounterController.remove);

// Queue assignment
router.post("/:id/queues", authenticate, requireCompanyAdmin, CounterController.assignQueue);
router.delete("/:id/queues/:queueGroupId", authenticate, requireCompanyAdmin, CounterController.removeQueue);

export const counterRoutes = router;
