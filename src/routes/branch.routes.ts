import { Router } from "express";
import { BranchController } from "../controllers/branch.controller";
import { authenticate, requireCompanyAdmin } from "../middlewares/auth.middleware";

const router = Router();

router.get("/", authenticate, requireCompanyAdmin, BranchController.list);
router.post("/", authenticate, requireCompanyAdmin, BranchController.create);
router.get("/:id", authenticate, requireCompanyAdmin, BranchController.findOne);
router.patch("/:id", authenticate, requireCompanyAdmin, BranchController.update);
router.delete("/:id", authenticate, requireCompanyAdmin, BranchController.remove);

export const branchRoutes = router;
