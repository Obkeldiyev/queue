import { Router } from "express";
import { OrderController } from "../controllers/order.controller";
import { authenticate } from "../middlewares/auth.middleware";

const router = Router();

// Orders
router.get("/", authenticate, OrderController.list);
router.post("/", OrderController.create);         // Customers can create orders
router.get("/:id", authenticate, OrderController.findOne);
router.patch("/:id/status", authenticate, OrderController.updateStatus);

// Products
router.get("/products/list", OrderController.listProducts);   // Public product catalog
router.post("/products", authenticate, OrderController.createProduct);

// Product categories
router.get("/categories/list", OrderController.listCategories);
router.post("/categories", authenticate, OrderController.createCategory);

export const orderRoutes = router;
