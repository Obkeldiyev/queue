import { Response, NextFunction } from "express";
import prisma from "../prisma/client";
import { ErrorHandler } from "@errors";
import { createAuditLog } from "@utils";
import type { CreateBranchDto, UpdateBranchDto } from "../dto/branch.dto";
import type { AuthRequest } from "@middlewares";

function getCompanyId(req: AuthRequest): string | undefined {
  return req.user?.type === "company_user" ? req.user.companyId : undefined;
}

export class BranchController {
  static async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      // Company users are ALWAYS scoped to their own company — ignore any company_id param
      const companyId = req.user?.type === "company_user"
        ? req.user.companyId
        : (req.query.company_id as string | undefined);
      const where: Record<string, unknown> = {};
      if (companyId) where.company_id = companyId;
      if (req.query.status) where.status = req.query.status;

      const branches = await prisma.branch.findMany({
        where,
        orderBy: { created_at: "asc" },
        include: { _count: { select: { queue_groups: true, devices: true, users: true } } },
      });
      res.json({ success: true, data: branches });
    } catch (e) { next(e); }
  }

  static async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = req.body as CreateBranchDto & { company_id?: string };
      const companyId = body.company_id ?? getCompanyId(req);
      if (!companyId) return next(new ErrorHandler("company_id required", 400));
      if (!body.name_uz) return next(new ErrorHandler("name_uz required", 400));

      const company = await prisma.company.findUnique({ where: { id: companyId } });
      if (!company) return next(new ErrorHandler("Company not found", 404));

      const branch = await prisma.branch.create({
        data: {
          company_id: companyId,
          name_uz: body.name_uz,
          name_ru: body.name_ru,
          name_en: body.name_en,
          phone: body.phone,
          email: body.email,
          address_uz: body.address_uz,
          address_ru: body.address_ru,
          address_en: body.address_en,
          latitude: body.latitude,
          longitude: body.longitude,
          working_hours: (body.working_hours ?? undefined) as any,
          timezone: body.timezone,
        },
      });

      await createAuditLog({
        req, companyId,
        companyUserId: req.user?.type === "company_user" ? req.user.sub : undefined,
        platformUserId: req.user?.type === "platform_user" ? req.user.sub : undefined,
        action: "CREATE", entityType: "Branch", entityId: branch.id, branchId: branch.id,
      });

      res.status(201).json({ success: true, data: branch });
    } catch (e) { next(e); }
  }

  static async findOne(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const branch = await prisma.branch.findUnique({
        where: { id: req.params.id },
        include: {
          queue_groups: { include: { service: true } },
          counters: true, devices: true,
          company: { include: { logo_media: true } },
          _count: { select: { tickets: true, orders: true } },
        },
      });
      if (!branch) return next(new ErrorHandler("Branch not found", 404));
      res.json({ success: true, data: branch });
    } catch (e) { next(e); }
  }

  static async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = req.body as UpdateBranchDto;
      const existing = await prisma.branch.findUnique({ where: { id: req.params.id } });
      if (!existing) return next(new ErrorHandler("Branch not found", 404));

      const branch = await prisma.branch.update({
        where: { id: req.params.id },
        data: {
          name_uz: body.name_uz,
          name_ru: body.name_ru,
          name_en: body.name_en,
          phone: body.phone,
          email: body.email,
          address_uz: body.address_uz,
          address_ru: body.address_ru,
          address_en: body.address_en,
          latitude: body.latitude,
          longitude: body.longitude,
          working_hours: (body.working_hours ?? undefined) as any,
          timezone: body.timezone,
          ...(body.status && { status: body.status }),
        } as any,
      });

      await createAuditLog({
        req, companyId: branch.company_id,
        companyUserId: req.user?.type === "company_user" ? req.user.sub : undefined,
        action: "UPDATE", entityType: "Branch", entityId: branch.id, branchId: branch.id,
      });

      res.json({ success: true, data: branch });
    } catch (e) { next(e); }
  }

  static async remove(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const existing = await prisma.branch.findUnique({ where: { id: req.params.id } });
      if (!existing) return next(new ErrorHandler("Branch not found", 404));
      await prisma.branch.delete({ where: { id: req.params.id } });
      await createAuditLog({
        req, companyId: existing.company_id,
        platformUserId: req.user?.type === "platform_user" ? req.user.sub : undefined,
        companyUserId: req.user?.type === "company_user" ? req.user.sub : undefined,
        action: "DELETE", entityType: "Branch", entityId: req.params.id,
      });
      res.json({ success: true, message: "Branch deleted" });
    } catch (e) { next(e); }
  }
}


