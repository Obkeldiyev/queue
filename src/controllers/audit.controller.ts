import { Response, NextFunction } from "express";
import prisma from "../prisma/client";
import type { AuthRequest } from "@middlewares";

export class AuditController {
  // GET /audit-logs
  static async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user?.type === "company_user" ? req.user.companyId : (req.query.company_id as string | undefined);
      const page = Math.max(1, Number.parseInt(String(req.query.page),10) || 1);
      const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit),10) || 50));
      const where: Record<string, unknown> = {};
      if (companyId) where.company_id = companyId;
      const admin = req.user?.type === "platform_user" || req.user?.roleTypes?.some(r=>["COMPANY_ADMIN","BRANCH_MANAGER","SUPERVISOR"].includes(r));
      if (!admin) where.company_user_id = req.user!.sub;
      if (req.query.action) where.action = req.query.action;
      if (req.query.entity_type) where.entity_type = req.query.entity_type;
      if (req.query.branch_id) where.branch_id = req.query.branch_id;
      if (req.query.from || req.query.to) {
        where.created_at = {};
        if (req.query.from) (where.created_at as Record<string, unknown>).gte = new Date(req.query.from as string);
        if (req.query.to) (where.created_at as Record<string, unknown>).lte = new Date(req.query.to as string);
      }

      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { created_at: "desc" },
          include: {
            company_user: { select: { id: true, first_name: true, last_name: true, email: true } },
            platform_user: { select: { id: true, first_name: true, last_name: true, email: true } },
          },
        }),
        prisma.auditLog.count({ where }),
      ]);
      res.json({ success: true, data: logs, meta: { total, page, limit } });
    } catch (e) { next(e); }
  }
}




