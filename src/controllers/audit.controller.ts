import { Response, NextFunction } from "express";
import prisma from "../prisma/client";
import type { AuthRequest } from "@middlewares";

export class AuditController {
  // GET /audit-logs
  static async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user?.type === "company_user" ? req.user.companyId : (req.query.company_id as string | undefined);
      const page = parseInt(req.query.page as string || "1");
      const limit = parseInt(req.query.limit as string || "50");
      const where: Record<string, unknown> = {};
      if (companyId) where.company_id = companyId;
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




