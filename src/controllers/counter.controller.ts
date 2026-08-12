import { Response, NextFunction } from "express";
import prisma from "../prisma/client";
import { ErrorHandler } from "@errors";
import { createAuditLog } from "@utils";
import { broadcast } from "../utils/websocket";
import type { CreateCounterDto, UpdateCounterDto, AssignQueueToCounterDto, OpenCounterSessionDto } from "../dto/counter.dto";
import type { AuthRequest } from "@middlewares";

export class CounterController {
  static async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user?.type === "company_user" ? req.user.companyId : (req.query.company_id as string | undefined);
      const branchId = req.query.branch_id as string | undefined;
      const where: Record<string, unknown> = {};
      if (companyId) where.company_id = companyId;
      if (branchId) where.branch_id = branchId;

      const counters = await prisma.counter.findMany({
        where,
        orderBy: { number: "asc" },
        include: {
          queue_groups: { include: { queue_group: { include: { service: true } } } },
          sessions: {
            where: { is_active: true },
            include: { company_user: { select: { id: true, first_name: true, last_name: true } } },
            take: 1,
          },
          _count: { select: { tickets: true } },
        },
      });
      res.json({ success: true, data: counters });
    } catch (e) { next(e); }
  }

  static async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = req.body as CreateCounterDto & { company_id?: string };
      const companyId = req.user?.type === "company_user" ? req.user.companyId : (body.company_id ?? undefined);
      if (!companyId) return next(new ErrorHandler("company_id required", 400));
      if (!body.name_uz) return next(new ErrorHandler("name_uz required", 400));

      const exists = await prisma.counter.findFirst({ where: { branch_id: body.branch_id, number: body.number } });
      if (exists) return next(new ErrorHandler(`Counter number ${body.number} already exists in this branch`, 409));

      const counter = await prisma.counter.create({
        data: {
          company_id: companyId,
          branch_id: body.branch_id,
          name_uz: body.name_uz,
          name_ru: body.name_ru,
          name_en: body.name_en,
          number: body.number,
          description: body.description,
        },
      });

      await createAuditLog({
        req, companyId,
        companyUserId: req.user?.type === "company_user" ? req.user.sub : undefined,
        action: "CREATE", entityType: "Counter", entityId: counter.id,
      });

      res.status(201).json({ success: true, data: counter });
    } catch (e) { next(e); }
  }

  static async findOne(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const counter = await prisma.counter.findUnique({
        where: { id: req.params.id },
        include: {
          queue_groups: { include: { queue_group: { include: { service: true } } } },
          sessions: {
            where: { is_active: true },
            include: { company_user: { select: { id: true, first_name: true, last_name: true } } },
          },
          devices: true,
        },
      });
      if (!counter) return next(new ErrorHandler("Counter not found", 404));
      res.json({ success: true, data: counter });
    } catch (e) { next(e); }
  }

  static async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = req.body as UpdateCounterDto;
      const counter = await prisma.counter.update({
        where: { id: req.params.id },
        data: {
          ...(body.name_uz !== undefined && { name_uz: body.name_uz }),
          ...(body.name_ru !== undefined && { name_ru: body.name_ru }),
          ...(body.name_en !== undefined && { name_en: body.name_en }),
          ...(body.description !== undefined && { description: body.description }),
          ...(body.is_active !== undefined && { is_active: body.is_active }),
          ...(body.number !== undefined && { number: Number(body.number) }),
        },
      });
      res.json({ success: true, data: counter });
    } catch (e) { next(e); }
  }

  static async remove(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await prisma.counter.delete({ where: { id: _req.params.id } });
      res.json({ success: true, message: "Counter deleted" });
    } catch (e) { next(e); }
  }

  static async assignQueue(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = req.body as AssignQueueToCounterDto;
      const existing = await prisma.counterQueue.findFirst({
        where: { counter_id: req.params.id, queue_group_id: body.queue_group_id },
      });
      if (existing) return next(new ErrorHandler("Queue already assigned to this counter", 409));

      const cq = await prisma.counterQueue.create({
        data: { counter_id: req.params.id, queue_group_id: body.queue_group_id, sort_order: body.sort_order ?? 0 },
        include: { queue_group: { include: { service: true } } },
      });
      res.status(201).json({ success: true, data: cq });
    } catch (e) { next(e); }
  }

  static async removeQueue(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await prisma.counterQueue.delete({
        where: {
          counter_id_queue_group_id: {
            counter_id: req.params.id,
            queue_group_id: req.params.queueGroupId,
          },
        },
      });
      res.json({ success: true, message: "Queue unassigned" });
    } catch (e) { next(e); }
  }

  static async openSession(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = req.body as OpenCounterSessionDto;
      console.log("openSession called", { body, user: req.user && { id: req.user.sub, type: req.user.type, companyId: req.user.companyId, branchId: req.user.branchId } });
      if (req.user?.type !== "company_user") return next(new ErrorHandler("Company user required", 403));

      // Close any existing sessions for this user
      await prisma.counterSession.updateMany({
        where: { company_user_id: req.user.sub, is_active: true },
        data: { is_active: false, ended_at: new Date() },
      });

      // If client didn't provide a counter_id, prefer admin-assigned operator counter, otherwise pick sensible default
      let counterIdToOpen = (body as any)?.counter_id as string | undefined;
      if (!counterIdToOpen) {
        // Try operator's assigned default counter on their user record
        // select typed as any because Prisma client hasn't been regenerated in this environment yet
        const companyUser = await prisma.companyUser.findUnique({ where: { id: req.user.sub }, select: { default_counter_id: true } as any }) as any;
        if (companyUser?.default_counter_id) {
          counterIdToOpen = companyUser.default_counter_id;
        }
      }

      if (!counterIdToOpen) {
        const defaultCounter = await prisma.counter.findFirst({
          where: { company_id: req.user.companyId ?? undefined, branch_id: req.user.branchId ?? undefined, is_active: true },
          orderBy: { number: "asc" },
        });
        if (!defaultCounter) return next(new ErrorHandler("No available counter to open session", 400));
        counterIdToOpen = defaultCounter.id;
      }

      if (!counterIdToOpen) {
        console.warn("openSession: computed counterIdToOpen is missing", { body, user: req.user });
        return next(new ErrorHandler("No available counter to open session", 400));
      }

      // Use explicit nested connect to avoid passing undefined `counter_id` to Prisma.
      const session = await prisma.counterSession.create({
        data: {
          counter: { connect: { id: counterIdToOpen } },
          company_user: { connect: { id: req.user.sub } },
        },
        include: { counter: true, company_user: { select: { id: true, first_name: true, last_name: true } } },
      });

      await createAuditLog({
        req,
        companyId: session.counter.company_id,
        branchId: session.counter.branch_id,
        companyUserId: req.user.sub,
        action: "TOGGLE_STATUS",
        entityType: "CounterSession",
        entityId: session.id,
        metadata: { state: "opened", counter_id: session.counter.id, counter_number: session.counter.number },
      });

      broadcast({
        event: "counter:session_opened",
        branchId: session.counter.branch_id,
        companyId: session.counter.company_id,
        payload: {
          session_id: session.id,
          counter_id: session.counter.id,
          counter_number: session.counter.number,
          operator_id: req.user.sub,
        },
      });

      res.status(201).json({ success: true, data: session });
    } catch (e) {
      try {
        console.error("openSession error", { error: e instanceof Error ? e.message : e, stack: e instanceof Error ? e.stack : undefined, user: req.user, body: req.body });
      } catch (_) { /* ignore logging errors */ }
      next(e);
    }
  }

  static async closeSession(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (req.user?.type !== "company_user") return next(new ErrorHandler("Company user required", 403));
      const activeSessions = await prisma.counterSession.findMany({
        where: { company_user_id: req.user.sub, is_active: true },
        include: { counter: true },
      });

      await prisma.counterSession.updateMany({
        where: { company_user_id: req.user.sub, is_active: true },
        data: { is_active: false, ended_at: new Date() },
      });

      await Promise.all(activeSessions.map((session) =>
        createAuditLog({
          req,
          companyId: session.counter.company_id,
          branchId: session.counter.branch_id,
          companyUserId: req.user!.sub,
          action: "TOGGLE_STATUS",
          entityType: "CounterSession",
          entityId: session.id,
          metadata: { state: "closed", counter_id: session.counter.id, counter_number: session.counter.number },
        })
      ));

      activeSessions.forEach((session) => {
        broadcast({
          event: "counter:session_closed",
          branchId: session.counter.branch_id,
          companyId: session.counter.company_id,
          payload: {
            session_id: session.id,
            counter_id: session.counter.id,
            counter_number: session.counter.number,
            operator_id: req.user!.sub,
          },
        });
      });

      res.json({ success: true, message: "Session closed" });
    } catch (e) { next(e); }
  }
}



