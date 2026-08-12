import { Router } from "express";
import { MenuController } from "../controllers/menu.controller";
import { authenticate, requireCompanyAdmin } from "../middlewares/auth.middleware";

const router = Router();

router.get("/", MenuController.list);              // Public menu structure
router.post("/", authenticate, requireCompanyAdmin, MenuController.create);
router.patch("/reorder", authenticate, requireCompanyAdmin, MenuController.reorder);
router.patch("/:id", authenticate, requireCompanyAdmin, MenuController.update);
router.delete("/:id", authenticate, requireCompanyAdmin, MenuController.remove);

export const menuRoutes = router;
