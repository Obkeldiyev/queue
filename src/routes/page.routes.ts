import { Router } from "express";
import { PageController } from "../controllers/page.controller";
import { authenticate } from "../middlewares/auth.middleware";

const router = Router();

router.get("/", authenticate, PageController.list);
router.post("/", authenticate, PageController.create);
router.get("/:id", PageController.findOne);       // Published pages readable publicly
router.patch("/:id", authenticate, PageController.update);
router.delete("/:id", authenticate, PageController.remove);
router.post("/:id/publish", authenticate, PageController.publish);
router.post("/:id/components", authenticate, PageController.addComponent);
router.patch("/:id/components/:componentId", authenticate, PageController.updateComponent);
router.delete("/:id/components/:componentId", authenticate, PageController.removeComponent);

export const pageRoutes = router;
