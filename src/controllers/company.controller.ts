import { Request, Response, NextFunction } from "express";
import prisma from "../prisma/client";
import { ErrorHandler } from "@errors";
import { createAuditLog } from "@utils";
import { ensureDefaultCompanyRoles } from "../utils/company-roles";
import type { CreateCompanyDto, UpdateCompanyDto, CreateSubscriptionDto, AssignSubscriptionDto } from "../dto/company.dto";
import type { AuthRequest } from "@middlewares";

export class CompanyController {
  // GET /companies
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { search, status, page = "1", limit = "20" } = req.query;
      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
      const where: Record<string, unknown> = {};
      if (search) where.name = { contains: search as string, mode: "insensitive" };
      if (status) where.status = status;

      const [companies, total] = await Promise.all([
        prisma.company.findMany({
          where,
          skip,
          take: parseInt(limit as string),
          orderBy: { created_at: "desc" },
          include: {
            _count: { select: { branches: true, users: true, devices: true } },
            company_subscriptions: {
              where: { status: "ACTIVE" },
              include: { subscription: true },
              take: 1,
            },
          },
        }),
        prisma.company.count({ where }),
      ]);

      res.json({ success: true, data: companies, meta: { total, page: parseInt(page as string), limit: parseInt(limit as string) } });
    } catch (e) { next(e); }
  }

  // POST /companies
  static async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = req.body as CreateCompanyDto;
      const slugExists = await prisma.company.findUnique({ where: { slug: body.slug } });
      if (slugExists) return next(new ErrorHandler("Slug already taken", 409));

      const company = await prisma.company.create({
        data: {
          name: body.name,
          slug: body.slug,
          phone: body.phone,
          email: body.email,
          website: body.website,
          address: body.address,
          timezone: body.timezone ?? "Asia/Tashkent",
          locale: body.locale ?? "uz",
          primary_color: body.primary_color,
          secondary_color: body.secondary_color,
          status: "TRIAL",
        },
      });

      await ensureDefaultCompanyRoles(company.id);

      await createAuditLog({
        req,
        platformUserId: req.user?.type === "platform_user" ? req.user.sub : undefined,
        action: "CREATE",
        entityType: "Company",
        entityId: company.id,
        afterState: company as unknown as object,
      });

      res.status(201).json({ success: true, data: company });
    } catch (e) { next(e); }
  }

  // GET /companies/:id
  static async findOne(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (req.user?.type === "company_user" && req.user.companyId !== req.params.id) {
        return next(new ErrorHandler("Forbidden", 403));
      }

      const company = await prisma.company.findUnique({
        where: { id: req.params.id },
        include: {
          branches: { select: { id: true, name_uz: true, name_ru: true, name_en: true, status: true } },
          _count: { select: { users: true, devices: true, services: true } },
          company_subscriptions: {
            where: { status: "ACTIVE" },
            include: { subscription: true },
            orderBy: { created_at: "desc" },
            take: 1,
          },
        },
      });
      if (!company) return next(new ErrorHandler("Company not found", 404));
      res.json({ success: true, data: company });
    } catch (e) { next(e); }
  }

  // PATCH /companies/:id
  static async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (req.user?.type === "company_user" && req.user.companyId !== req.params.id) {
        return next(new ErrorHandler("Forbidden", 403));
      }

      const body = req.body as UpdateCompanyDto;
      const existing = await prisma.company.findUnique({ where: { id: req.params.id } });
      if (!existing) return next(new ErrorHandler("Company not found", 404));

      const company = await prisma.company.update({
        where: { id: req.params.id },
        data: {
          name: body.name,
          phone: body.phone,
          email: body.email,
          website: body.website,
          address: body.address,
          timezone: body.timezone,
          locale: body.locale,
          primary_color: body.primary_color,
          secondary_color: body.secondary_color,
          ...(body.settings !== undefined && { settings: (body.settings as any) }),
          ...(body.status && { status: body.status }),
        } as any,
      });

      await createAuditLog({
        req,
        companyId: company.id,
        platformUserId: req.user?.type === "platform_user" ? req.user.sub : undefined,
        companyUserId: req.user?.type === "company_user" ? req.user.sub : undefined,
        action: "UPDATE",
        entityType: "Company",
        entityId: company.id,
        beforeState: existing as unknown as object,
        afterState: company as unknown as object,
      });

      res.json({ success: true, data: company });
    } catch (e) { next(e); }
  }

  // DELETE /companies/:id
  static async remove(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const existing = await prisma.company.findUnique({ where: { id: req.params.id } });
      if (!existing) return next(new ErrorHandler("Company not found", 404));
      await prisma.company.delete({ where: { id: req.params.id } });
      await createAuditLog({
        req,
        platformUserId: req.user?.sub,
        action: "DELETE",
        entityType: "Company",
        entityId: req.params.id,
      });
      res.json({ success: true, message: "Company deleted" });
    } catch (e) { next(e); }
  }

  // ---- Subscriptions ----
  // GET /subscriptions
  static async listSubscriptions(_req: Request, res: Response, next: NextFunction) {
    try {
      const subs = await prisma.subscription.findMany({ where: { is_active: true }, orderBy: { sort_order: "asc" } });
      res.json({ success: true, data: subs });
    } catch (e) { next(e); }
  }

  // POST /subscriptions
  static async createSubscription(req: Request, res: Response, next: NextFunction) {
    try {
      const body = req.body as CreateSubscriptionDto;
      const sub = await prisma.subscription.create({
        data: {
          name: body.name,
          description: body.description,
          monthly_price: body.monthly_price,
          yearly_price: body.yearly_price,
          max_branches: body.max_branches ?? 1,
          max_users: body.max_users ?? 5,
          max_devices: body.max_devices ?? 10,
          max_storage_gb: body.max_storage_gb ?? 5,
          online_queue_enabled: body.online_queue_enabled ?? false,
          ordering_enabled: body.ordering_enabled ?? false,
          analytics_enabled: body.analytics_enabled ?? false,
          custom_domain_enabled: body.custom_domain_enabled ?? false,
          api_access_enabled: body.api_access_enabled ?? false,
        },
      });
      res.status(201).json({ success: true, data: sub });
    } catch (e) { next(e); }
  }

  // POST /companies/:id/subscription
  static async assignSubscription(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = req.body as AssignSubscriptionDto;
      const company = await prisma.company.findUnique({ where: { id: req.params.id } });
      if (!company) return next(new ErrorHandler("Company not found", 404));

      // Expire existing active subscriptions
      await prisma.companySubscription.updateMany({
        where: { company_id: req.params.id, status: "ACTIVE" },
        data: { status: "CANCELLED" },
      });

      const cs = await prisma.companySubscription.create({
        data: {
          company_id: req.params.id,
          subscription_id: body.subscription_id,
          expires_at: new Date(body.expires_at),
          status: "ACTIVE",
          payment_method: body.payment_method as any,
          amount_paid: body.amount_paid,
        },
        include: { subscription: true },
      });

      // Upgrade company status to ACTIVE
      await prisma.company.update({ where: { id: req.params.id }, data: { status: "ACTIVE" as any } });

      res.json({ success: true, data: cs });
    } catch (e) { next(e); }
  }
}




