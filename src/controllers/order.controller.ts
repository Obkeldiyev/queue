import { Response, NextFunction } from "express";
import prisma from "../prisma/client";
import { ErrorHandler } from "@errors";
import { createAuditLog } from "@utils";
import type { CreateOrderDto, UpdateOrderStatusDto, CreateProductDto, CreateProductCategoryDto } from "../dto/order.dto";
import type { AuthRequest } from "@middlewares";

export class OrderController {
  // GET /orders
  static async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user?.type === "company_user" ? req.user.companyId : (req.query.company_id as string | undefined);
      const branchId = req.query.branch_id as string | undefined;
      const status = req.query.status as string | undefined;
      const page = parseInt(req.query.page as string || "1");
      const limit = parseInt(req.query.limit as string || "30");
      const where: Record<string, unknown> = {};
      if (companyId) where.company_id = companyId;
      if (branchId) where.branch_id = branchId;
      if (status) where.status = status;

      const [orders, total] = await Promise.all([
        prisma.order.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { created_at: "desc" },
          include: {
            items: { include: { product: true, modifiers: { include: { product_modifier: true } } } },
            customer: { select: { id: true, first_name: true, last_name: true, phone: true } },
            branch: { select: { id: true, name_uz: true, name_ru: true, name_en: true } },
            payments: true,
          },
        }),
        prisma.order.count({ where }),
      ]);
      res.json({ success: true, data: orders, meta: { total, page } });
    } catch (e) { next(e); }
  }

  // POST /orders
  static async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = req.body as CreateOrderDto & { company_id?: string };
      const companyId = req.user?.type === "company_user" ? req.user.companyId : (body.company_id ?? undefined);
      if (!companyId) return next(new ErrorHandler("company_id required", 400));

      // Load products
      const productIds = body.items.map((i) => i.product_id);
      const products = await prisma.product.findMany({ where: { id: { in: productIds } } });

      let subtotal = 0;
      const itemsData = body.items.map((i) => {
        const product = products.find((p: { id: string; discount_price: unknown; price: unknown }) => p.id === i.product_id);
        if (!product) throw new ErrorHandler(`Product ${i.product_id} not found`, 404);
        const unit_price = Number(product.discount_price ?? product.price);
        const total_price = unit_price * i.quantity;
        subtotal += total_price;
        return { product_id: i.product_id, quantity: i.quantity, unit_price, total_price, notes: i.notes };
      });

      const today = new Date();
      const orderCount = await prisma.order.count({ where: { branch_id: body.branch_id } });
      const order_number = `O${String(orderCount + 1).padStart(4, "0")}`;

      const order = await prisma.order.create({
        data: {
          company_id: companyId,
          branch_id: body.branch_id,
          customer_id: body.customer_id,
          order_number,
          subtotal,
          total: subtotal,
          payment_method: body.payment_method as any,
          notes: body.notes,
          items: { create: itemsData },
        },
        include: { items: { include: { product: true } }, branch: { select: { id: true, name_uz: true, name_ru: true, name_en: true } } },
      });

      await createAuditLog({
        req, companyId, branchId: body.branch_id,
        companyUserId: req.user?.type === "company_user" ? req.user.sub : undefined,
        action: "CREATE", entityType: "Order", entityId: order.id,
        afterState: { order_number },
      });

      res.status(201).json({ success: true, data: order });
    } catch (e) { next(e); }
  }

  // GET /orders/:id
  static async findOne(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const order = await prisma.order.findUnique({
        where: { id: req.params.id },
        include: {
          items: { include: { product: true, modifiers: { include: { product_modifier: true } } } },
          customer: true, branch: true, payments: true,
          stage_history: { include: { stage: true }, orderBy: { entered_at: "asc" } },
        },
      });
      if (!order) return next(new ErrorHandler("Order not found", 404));
      res.json({ success: true, data: order });
    } catch (e) { next(e); }
  }

  // PATCH /orders/:id/status
  static async updateStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = req.body as UpdateOrderStatusDto;
      const existing = await prisma.order.findUnique({ where: { id: req.params.id } });
      if (!existing) return next(new ErrorHandler("Order not found", 404));

      const order = await prisma.order.update({
        where: { id: req.params.id },
        data: {
          status: body.status as any,
          completed_at: body.status === "COMPLETED" ? new Date() : undefined,
        },
      });
      res.json({ success: true, data: order });
    } catch (e) { next(e); }
  }

  // ---- Products ----
  // GET /products
  static async listProducts(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user?.type === "company_user" ? req.user.companyId : (req.query.company_id as string | undefined);
      const where: Record<string, unknown> = {};
      if (companyId) where.company_id = companyId;
      if (req.query.category_id) where.category_id = req.query.category_id;
      if (req.query.status) where.status = req.query.status;

      const products = await prisma.product.findMany({
        where,
        orderBy: [{ sort_order: "asc" }, { name: "asc" }],
        include: { category: { select: { id: true, name: true } }, modifiers: true },
      });
      res.json({ success: true, data: products });
    } catch (e) { next(e); }
  }

  // POST /products
  static async createProduct(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = req.body as CreateProductDto & { company_id?: string };
      const companyId = req.user?.type === "company_user" ? req.user.companyId : (body.company_id ?? undefined);
      if (!companyId) return next(new ErrorHandler("company_id required", 400));

      const product = await prisma.product.create({
        data: {
          company_id: companyId,
          category_id: body.category_id,
          name: body.name,
          description: body.description,
          price: body.price,
          discount_price: body.discount_price,
          sku: body.sku,
          preparation_time_mins: body.preparation_time_mins,
          sort_order: body.sort_order ?? 0,
        },
      });
      res.status(201).json({ success: true, data: product });
    } catch (e) { next(e); }
  }

  // GET /product-categories
  static async listCategories(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user?.type === "company_user" ? req.user.companyId : (req.query.company_id as string | undefined);
      const cats = await prisma.productCategory.findMany({
        where: companyId ? { company_id: companyId } : undefined,
        orderBy: { sort_order: "asc" },
        include: { children: true, _count: { select: { products: true } } },
      });
      res.json({ success: true, data: cats });
    } catch (e) { next(e); }
  }

  // POST /product-categories
  static async createCategory(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = req.body as CreateProductCategoryDto & { company_id?: string };
      const companyId = req.user?.type === "company_user" ? req.user.companyId : (body.company_id ?? undefined);
      if (!companyId) return next(new ErrorHandler("company_id required", 400));

      const cat = await prisma.productCategory.create({
        data: {
          company_id: companyId,
          parent_id: body.parent_id,
          name: body.name,
          description: body.description,
          sort_order: body.sort_order ?? 0,
        },
      });
      res.status(201).json({ success: true, data: cat });
    } catch (e) { next(e); }
  }
}







