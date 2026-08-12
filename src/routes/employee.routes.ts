import { Router } from "express";
import { EmployeeController } from "../controllers/employee.controller";
import { authenticate, requireCompanyAdmin } from "../middlewares/auth.middleware";

const router = Router();

// Roles & permissions
router.get("/roles/list", authenticate, requireCompanyAdmin, EmployeeController.listRoles);
router.post("/roles", authenticate, requireCompanyAdmin, EmployeeController.createRole);
router.get("/permissions/list", authenticate, requireCompanyAdmin, EmployeeController.listPermissions);

// Employees (company users)
router.get("/", authenticate, requireCompanyAdmin, EmployeeController.list);
router.post("/", authenticate, requireCompanyAdmin, EmployeeController.create);
router.get("/:id", authenticate, requireCompanyAdmin, EmployeeController.findOne);
router.patch("/:id", authenticate, requireCompanyAdmin, EmployeeController.update);
router.delete("/:id", authenticate, requireCompanyAdmin, EmployeeController.remove);

export const employeeRoutes = router;
