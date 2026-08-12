import { Request, Response, NextFunction } from "express";
import prisma from "../prisma/client";
import { ErrorHandler } from "@errors";
import { createAuditLog } from "@utils";
import type { CreateServiceDto, UpdateServiceDto } from "../dto/service.dto";
import type { AuthRequest } from "@middlewares";

export class ServiceController {
  static async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user?.type === "company_user" ? req.user.companyId : (req.query.company_id as string | undefined);
      const where: Record<string, unknown> = {};
      if (companyId) where.company_id = companyId;
      if (req.query.status) where.status = req.query.status;

      const services = await prisma.service.findMany({
        where,
        orderBy: { priority_level: "asc" },
        include: { _count: { select: { queue_groups: true } } },
      });
      res.json({ success: true, data: services });
    } catch (e) { next(e); }
  }

  static async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = req.body as CreateServiceDto & { company_id?: string };
      const companyId = req.user?.type === "company_user" ? req.user.companyId : (body.company_id ?? undefined);
      if (!companyId) return next(new ErrorHandler("company_id required", 400));
      if (!body.name_uz) return next(new ErrorHandler("name_uz required", 400));

      const service = await prisma.service.create({
        data: {
          company_id: companyId,
          name_uz: body.name_uz,
          name_ru: body.name_ru,
          name_en: body.name_en,
          description_uz: body.description_uz,
          description_ru: body.description_ru,
          description_en: body.description_en,
          estimated_time_mins: body.estimated_time_mins,
          priority_level: body.priority_level ?? 0,
          working_hours: (body.working_hours ?? undefined) as any,
          color: body.color,
        },
      });

      await createAuditLog({
        req, companyId,
        companyUserId: req.user?.type === "company_user" ? req.user.sub : undefined,
        action: "CREATE", entityType: "Service", entityId: service.id,
      });

      res.status(201).json({ success: true, data: service });
    } catch (e) { next(e); }
  }

  static async findOne(req: Request, res: Response, next: NextFunction) {
    try {
      const service = await prisma.service.findUnique({
        where: { id: req.params.id },
        include: { queue_groups: true },
      });
      if (!service) return next(new ErrorHandler("Service not found", 404));
      res.json({ success: true, data: service });
    } catch (e) { next(e); }
  }

  static async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = req.body as UpdateServiceDto;
      const existing = await prisma.service.findUnique({ where: { id: req.params.id } });
      if (!existing) return next(new ErrorHandler("Service not found", 404));

      const service = await prisma.service.update({
        where: { id: req.params.id },
        data: {
          name_uz: body.name_uz,
          name_ru: body.name_ru,
          name_en: body.name_en,
          description_uz: body.description_uz,
          description_ru: body.description_ru,
          description_en: body.description_en,
          estimated_time_mins: body.estimated_time_mins,
          priority_level: body.priority_level,
          color: body.color,
          working_hours: (body.working_hours ?? undefined) as any,
          ...(body.status && { status: body.status }),
        } as any,
      });

      await createAuditLog({
        req, companyId: service.company_id,
        companyUserId: req.user?.type === "company_user" ? req.user.sub : undefined,
        action: "UPDATE", entityType: "Service", entityId: service.id,
      });

      res.json({ success: true, data: service });
    } catch (e) { next(e); }
  }

  static async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const existing = await prisma.service.findUnique({ where: { id: req.params.id } });
      if (!existing) return next(new ErrorHandler("Service not found", 404));
      await prisma.service.delete({ where: { id: req.params.id } });
      res.json({ success: true, message: "Service deleted" });
    } catch (e) { next(e); }
  }
}



