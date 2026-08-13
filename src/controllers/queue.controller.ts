import { Response, NextFunction } from "express";
import prisma from "../prisma/client";
import { ErrorHandler } from "@errors";
import { createAuditLog } from "@utils";
import { broadcast } from "../utils/websocket";
import type { CreateQueueGroupDto, UpdateQueueGroupDto, IssueTicketDto, CallNextDto, TransferTicketDto } from "../dto/queue.dto";
import type { AuthRequest } from "@middlewares";

function generateTicketNumber(format: string, seq: number): string {
  // Format: "{PREFIX}{NUM:3}" or "LOAN-{NUM:4}" etc.
  return format.replace(/\{NUM:(\d+)\}/g, (_m, digits) => String(seq).padStart(parseInt(digits), "0"));
}

export class QueueController {
  // ---- Queue Groups ----

  // GET /queues
  static async listGroups(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user?.type === "company_user" ? req.user.companyId : (req.query.company_id as string | undefined);
      const branchId = req.query.branch_id as string | undefined;
      const where: Record<string, unknown> = {};
      if (companyId) where.company_id = companyId;
      if (branchId) where.branch_id = branchId;

      const groups = await prisma.queueGroup.findMany({
        where,
        orderBy: [{ sort_order: "asc" }, { created_at: "asc" }],
        include: {
          service: true,
          branch: { select: { id: true, name_uz: true } },
          _count: { select: { tickets: true } },
        },
      });
      res.json({ success: true, data: groups });
    } catch (e) { next(e); }
  }

  // POST /queues
  static async createGroup(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = req.body as CreateQueueGroupDto & { company_id?: string };
      const companyId = req.user?.type === "company_user" ? req.user.companyId : (body.company_id ?? undefined);
      if (!companyId) return next(new ErrorHandler("company_id required", 400));

      const group = await prisma.queueGroup.create({
        data: {
          company_id: companyId,
          branch_id: body.branch_id,
          service_id: body.service_id,
          name_uz: body.name_uz,
          name_ru: body.name_ru,
          name_en: body.name_en,
          prefix: body.prefix,
          number_format: body.number_format ?? `${body.prefix}{NUM:3}`,
          queue_type: (body.queue_type as any) ?? "SEQUENTIAL",
          daily_limit: body.daily_limit,
          daily_reset_time: body.daily_reset_time,
          priority_weight: body.priority_weight ?? 0,
          online_enabled: body.online_enabled ?? false,
          auto_recall_enabled: body.auto_recall_enabled ?? false,
          auto_recall_after_sec: body.auto_recall_after_sec ?? 30,
          no_show_after_sec: body.no_show_after_sec ?? 300,
          working_hours: body.working_hours ?? undefined,
        },
        include: { service: true },
      });

      await createAuditLog({
        req, companyId,
        companyUserId: req.user?.type === "company_user" ? req.user.sub : undefined,
        action: "CREATE", entityType: "QueueGroup", entityId: group.id,
      });

      res.status(201).json({ success: true, data: group });
    } catch (e) { next(e); }
  }

  // GET /queues/:id
  static async findOneGroup(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const group = await prisma.queueGroup.findUnique({
        where: { id: req.params.id },
        include: {
          service: true,
          branch: true,
          counter_queues: { include: { counter: true } },
          _count: { select: { tickets: true } },
        },
      });
      if (!group) return next(new ErrorHandler("Queue group not found", 404));
      res.json({ success: true, data: group });
    } catch (e) { next(e); }
  }

  // PATCH /queues/:id
  static async updateGroup(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = req.body as UpdateQueueGroupDto;
      const existing = await prisma.queueGroup.findUnique({ where: { id: req.params.id } });
      if (!existing) return next(new ErrorHandler("Queue group not found", 404));

      const group = await prisma.queueGroup.update({
        where: { id: req.params.id },
        data: {
          name_uz: body.name_uz,
          name_ru: body.name_ru,
          name_en: body.name_en,
          prefix: body.prefix,
          number_format: body.number_format,
          queue_type: body.queue_type as any,
          daily_limit: body.daily_limit,
          daily_reset_time: body.daily_reset_time,
          priority_weight: body.priority_weight,
          online_enabled: body.online_enabled,
          auto_recall_enabled: body.auto_recall_enabled,
          auto_recall_after_sec: body.auto_recall_after_sec,
          no_show_after_sec: body.no_show_after_sec,
          working_hours: (body.working_hours ?? undefined) as any,
          is_active: body.is_active,
          sort_order: body.sort_order,
        } as any,
      });

      await createAuditLog({
        req, companyId: group.company_id,
        companyUserId: req.user?.type === "company_user" ? req.user.sub : undefined,
        action: "UPDATE", entityType: "QueueGroup", entityId: group.id,
      });

      res.json({ success: true, data: group });
    } catch (e) { next(e); }
  }

  // DELETE /queues/:id
  static async removeGroup(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const existing = await prisma.queueGroup.findUnique({ where: { id: req.params.id } });
      if (!existing) return next(new ErrorHandler("Queue group not found", 404));
      await prisma.queueGroup.delete({ where: { id: req.params.id } });
      res.json({ success: true, message: "Queue group deleted" });
    } catch (e) { next(e); }
  }

  // ---- Tickets ----

  // POST /queues/tickets/issue  — issue a ticket
  static async issueTicket(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = req.body as IssueTicketDto;
      const group = await prisma.queueGroup.findUnique({ where: { id: body.queue_group_id } });
      if (!group) return next(new ErrorHandler("Queue group not found", 404));
      if (!group.is_active) return next(new ErrorHandler("Queue is not active", 400));
      if (body.is_online && !group.online_enabled) {
        return next(new ErrorHandler("Online queue not enabled for this group", 400));
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayCount = await prisma.ticket.count({
        where: { queue_group_id: group.id, created_at: { gte: today } },
      });

      if (group.daily_limit && todayCount >= group.daily_limit) {
        return next(new ErrorHandler("Daily queue limit reached", 429));
      }

      const seq = todayCount + 1;
      const ticketNumber = generateTicketNumber(group.number_format, seq);

      const ticket = await prisma.ticket.create({
        data: {
          queue_group_id: group.id,
          branch_id: body.branch_id ?? group.branch_id,
          customer_id: body.customer_id,
          ticket_number: ticketNumber,
          priority: body.priority ?? 0,
          notes: body.notes,
          is_online: body.is_online ?? false,
        },
        include: {
          queue_group: { include: { service: true } },
          branch: { select: { id: true, name_uz: true } },
        },
      });

      // Record history
      await prisma.ticketHistory.create({
        data: {
          ticket_id: ticket.id,
          to_status: "WAITING",
          changed_type: body.customer_id ? "customer" : "kiosk",
        },
      });

      // Update group's current_number
      await prisma.queueGroup.update({
        where: { id: group.id },
        data: { current_number: seq },
      });

      broadcast({
        event: "ticket:issued",
        branchId: ticket.branch_id,
        companyId: group.company_id,
        payload: { ticket_number: ticket.ticket_number, queue_group_id: group.id, ticket_id: ticket.id },
      });

      await createAuditLog({
        req, companyId: group.company_id, branchId: group.branch_id,
        action: "PRINT_TICKET", entityType: "Ticket", entityId: ticket.id,
      });

      res.status(201).json({ success: true, data: ticket });
    } catch (e) { next(e); }
  }

  // POST /queues/tickets/call-next
  static async callNext(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = req.body as CallNextDto;
      const counter = await prisma.counter.findUnique({
        where: { id: body.counter_id },
        include: { queue_groups: { include: { queue_group: true } } },
      });
      if (!counter) return next(new ErrorHandler("Counter not found", 404));

      const activeSession = await prisma.counterSession.findFirst({
        where: { counter_id: counter.id, is_active: true },
      });

      let queueGroupIds = counter.queue_groups.map((cq: { queue_group_id: string }) => cq.queue_group_id);

      // If the operator (authenticated user) is restricted to a single service,
      // restrict the candidate queue groups to only those belonging to that service.
      // Common user fields for this are `service_id` or `assigned_service_id`.
      const operatorServiceId = (req.user as any)?.service_id || (req.user as any)?.assigned_service_id;
      if (operatorServiceId) {
        const allowed = await prisma.queueGroup.findMany({
          where: { id: { in: queueGroupIds }, service_id: operatorServiceId },
          select: { id: true },
        });
        queueGroupIds = allowed.map((g) => g.id);
      }
      if (queueGroupIds.length === 0) return next(new ErrorHandler("No queues assigned to this counter", 400));

      // Smart priority: first by priority desc (lower number = higher priority), then FIFO
      // To avoid races when multiple counters call next concurrently, try to atomically
      // claim the next waiting ticket using updateMany with a guarded where clause.
      let updated: any = null;
      for (let attempt = 0; attempt < 4 && !updated; attempt++) {
        const candidate = await prisma.ticket.findFirst({
          where: { queue_group_id: { in: queueGroupIds }, status: "WAITING" },
          orderBy: [{ priority: "desc" }, { created_at: "asc" }],
        });
        if (!candidate) return next(new ErrorHandler("No tickets waiting", 404));

        const calledAt = new Date();
        const result = await prisma.ticket.updateMany({
          where: { id: candidate.id, status: "WAITING" },
          data: {
            status: "CALLED",
            counter_id: counter.id,
            counter_session_id: activeSession?.id,
            served_by_id: req.user?.type === "company_user" ? req.user.sub : undefined,
            called_at: calledAt,
            serving_started_at: calledAt,
          },
        });

        if (result.count === 0) {
          // Lost race on this ticket — retry
          continue;
        }

        // Successfully claimed; fetch the full record
        updated = await prisma.ticket.findUnique({ where: { id: candidate.id }, include: { queue_group: { include: { service: true } }, counter: true } });
      }

      if (!updated) return next(new ErrorHandler("Could not claim ticket, please retry", 409));

      await prisma.ticketHistory.create({
        data: {
          ticket_id: updated.id,
          from_status: "WAITING",
          to_status: "CALLED",
          changed_by: req.user?.sub,
          changed_type: "company_user",
        },
      });

      broadcast({
        event: "ticket:called",
        branchId: counter.branch_id,
        companyId: counter.company_id,
        payload: {
          ticket_number: updated.ticket_number,
          counter_id: counter.id,
          counter_name: counter.name_uz,
          ticket_id: updated.id,
        },
      });

      await createAuditLog({
        req, companyId: counter.company_id, branchId: counter.branch_id,
        companyUserId: req.user?.type === "company_user" ? req.user.sub : undefined,
        action: "CALL_NEXT", entityType: "Ticket", entityId: updated.id,
        metadata: { counter_id: counter.id, ticket_number: updated.ticket_number },
      });

      res.json({ success: true, data: updated });
    } catch (e) { next(e); }
  }

  // GET /queues/tickets — list tickets
  static async listTickets(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { branch_id, queue_group_id, status, page = "1", limit = "50" } = req.query;
      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
      const where: Record<string, unknown> = {};
      if (branch_id) where.branch_id = branch_id;
      if (queue_group_id) where.queue_group_id = queue_group_id;
      if (status) where.status = status;

      const [tickets, total] = await Promise.all([
        prisma.ticket.findMany({
          where,
          skip,
          take: parseInt(limit as string),
          orderBy: { created_at: "desc" },
          include: {
            queue_group: { include: { service: true } },
            counter: { select: { id: true, name_uz: true, name_ru: true, name_en: true, number: true } },
            customer: { select: { id: true, first_name: true, last_name: true, phone: true } },
          },
        }),
        prisma.ticket.count({ where }),
      ]);
      res.json({ success: true, data: tickets, meta: { total, page: parseInt(page as string) } });
    } catch (e) { next(e); }
  }

  // GET /queues/tickets/:id
  static async findOneTicket(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ticket = await prisma.ticket.findUnique({
        where: { id: req.params.id },
        include: {
          queue_group: { include: { service: true } },
          counter: true, customer: true,
          history: { orderBy: { created_at: "asc" } },
        },
      });
      if (!ticket) return next(new ErrorHandler("Ticket not found", 404));
      res.json({ success: true, data: ticket });
    } catch (e) { next(e); }
  }

  // PATCH /queues/tickets/:id/complete
  static async completeTicket(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id } });
      if (!ticket) return next(new ErrorHandler("Ticket not found", 404));
      if (!["CALLED", "SERVING"].includes(ticket.status)) {
        return next(new ErrorHandler("Ticket not in callable state", 400));
      }

      const now = new Date();
      const waitTimeSec = ticket.called_at
        ? Math.round((now.getTime() - ticket.called_at.getTime()) / 1000)
        : undefined;
      const serviceStart = ticket.serving_started_at ?? ticket.called_at ?? now;
      const serviceTimeSec = Math.max(0, Math.round((now.getTime() - serviceStart.getTime()) / 1000));

      const updated = await prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          status: "COMPLETED",
          completed_at: now,
          wait_time_sec: waitTimeSec,
          service_time_sec: serviceTimeSec,
          served_by_id: req.user?.type === "company_user" ? req.user.sub : ticket.served_by_id,
        },
      });

      await prisma.ticketHistory.create({
        data: { ticket_id: ticket.id, from_status: ticket.status, to_status: "COMPLETED", changed_by: req.user?.sub, changed_type: "company_user" },
      });

      broadcast({
        event: "ticket:completed",
        branchId: ticket.branch_id,
        payload: { ticket_id: ticket.id, ticket_number: updated.ticket_number },
      });

      await createAuditLog({
        req, companyId: (await prisma.queueGroup.findUnique({ where: { id: ticket.queue_group_id } }))?.company_id,
        branchId: ticket.branch_id,
        companyUserId: req.user?.type === "company_user" ? req.user.sub : undefined,
        action: "COMPLETE_SERVICE", entityType: "Ticket", entityId: ticket.id,
      });

      res.json({ success: true, data: updated });
    } catch (e) { next(e); }
  }

  // PATCH /queues/tickets/:id/recall
  static async recallTicket(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id } });
      if (!ticket) return next(new ErrorHandler("Ticket not found", 404));

      const updated = await prisma.ticket.update({
        where: { id: ticket.id },
        data: { status: "CALLED", called_at: new Date() },
      });

      await prisma.ticketHistory.create({
        data: { ticket_id: ticket.id, from_status: ticket.status, to_status: "CALLED", changed_by: req.user?.sub, note: "recall" },
      });

      res.json({ success: true, data: updated });
    } catch (e) { next(e); }
  }

  // PATCH /queues/tickets/:id/serve  — CALLED → SERVING
  static async serveTicket(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id } });
      if (!ticket) return next(new ErrorHandler("Ticket not found", 404));
      if (ticket.status !== "CALLED") {
        return next(new ErrorHandler(`Ticket is ${ticket.status}, not CALLED`, 400));
      }
      const now = new Date();
      const updated = await prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          status: "SERVING",
          serving_started_at: now,
          served_by_id: req.user?.type === "company_user" ? req.user.sub : ticket.served_by_id,
        },
        include: { queue_group: { include: { service: true } }, counter: true },
      });
      await prisma.ticketHistory.create({
        data: {
          ticket_id: ticket.id, from_status: "CALLED", to_status: "SERVING",
          changed_by: req.user?.sub, changed_type: "company_user",
        },
      });
      broadcast({
        event: "ticket:called",
        branchId: updated.branch_id,
        companyId: updated.queue_group?.company_id,
        payload: { ticket_id: updated.id, ticket_number: updated.ticket_number, counter_id: updated.counter_id, counter_name: updated.counter?.name_uz },
      });
      res.json({ success: true, data: updated });
    } catch (e) { next(e); }
  }

  // POST /queues/tickets/:id/assign
  static async assignTicket(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ticketId = req.params.id;
      const { counter_id, served_by_id } = req.body as { counter_id?: string; served_by_id?: string };

      const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
      if (!ticket) return next(new ErrorHandler("Ticket not found", 404));

      // Only assign waiting tickets (but allow reassigning CALLED => reassignment)
      if (!["WAITING", "CALLED"].includes(ticket.status)) {
        return next(new ErrorHandler("Ticket cannot be assigned in its current state", 400));
      }

      const counter = counter_id ? await prisma.counter.findUnique({ where: { id: counter_id } }) : null;

      const now = new Date();
      const updated = await prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          status: "CALLED",
          counter_id: counter ? counter.id : undefined,
          counter_session_id: undefined,
          served_by_id: served_by_id ?? (req.user?.type === "company_user" ? req.user.sub : undefined),
          called_at: now,
          serving_started_at: now,
        },
        include: { queue_group: { include: { service: true } }, counter: true },
      });

      await prisma.ticketHistory.create({
        data: {
          ticket_id: updated.id,
          from_status: ticket.status,
          to_status: "CALLED",
          changed_by: req.user?.sub,
          changed_type: "company_user",
          note: counter ? `Assigned to counter ${counter.id}` : "Assigned",
        },
      });

      broadcast({
        event: "ticket:called",
        branchId: updated.branch_id,
        companyId: updated.queue_group.company_id,
        payload: {
          ticket_number: updated.ticket_number,
          counter_id: updated.counter?.id,
          counter_name: updated.counter?.name_uz,
          ticket_id: updated.id,
        },
      });

      await createAuditLog({
        req, companyId: updated.queue_group.company_id, branchId: updated.branch_id,
        companyUserId: req.user?.type === "company_user" ? req.user.sub : undefined,
        action: "CALL_NEXT", entityType: "Ticket", entityId: updated.id,
        metadata: { counter_id: updated.counter?.id, ticket_number: updated.ticket_number },
      });

      res.json({ success: true, data: updated });
    } catch (e) { next(e); }
  }

  // PATCH /queues/tickets/:id/no-show
  static async noShow(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id } });
      if (!ticket) return next(new ErrorHandler("Ticket not found", 404));

      const updated = await prisma.ticket.update({
        where: { id: ticket.id },
        data: { status: "NO_SHOW" },
      });

      await prisma.ticketHistory.create({
        data: { ticket_id: ticket.id, from_status: ticket.status, to_status: "NO_SHOW", changed_by: req.user?.sub },
      });

      res.json({ success: true, data: updated });
    } catch (e) { next(e); }
  }

  // PATCH /queues/tickets/:id/cancel
  static async cancelTicket(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id } });
      if (!ticket) return next(new ErrorHandler("Ticket not found", 404));

      const updated = await prisma.ticket.update({
        where: { id: ticket.id },
        data: { status: "CANCELLED" },
      });

      await prisma.ticketHistory.create({
        data: { ticket_id: ticket.id, from_status: ticket.status, to_status: "CANCELLED", changed_by: req.user?.sub },
      });

      res.json({ success: true, data: updated });
    } catch (e) { next(e); }
  }

  // PATCH /queues/tickets/:id/transfer
  static async transferTicket(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = req.body as TransferTicketDto;
      const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id } });
      if (!ticket) return next(new ErrorHandler("Ticket not found", 404));

      const updated = await prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          status: "WAITING",
          counter_id: body.to_counter_id ?? null,
          queue_group_id: body.to_queue_group_id ?? ticket.queue_group_id,
          notes: body.notes ?? ticket.notes,
        },
      });

      await prisma.ticketHistory.create({
        data: {
          ticket_id: ticket.id, from_status: ticket.status, to_status: "TRANSFERRED",
          changed_by: req.user?.sub, note: `Transferred to counter ${body.to_counter_id ?? "—"}`,
        },
      });

      await createAuditLog({
        req, branchId: ticket.branch_id,
        companyUserId: req.user?.type === "company_user" ? req.user.sub : undefined,
        action: "TRANSFER", entityType: "Ticket", entityId: ticket.id,
      });

      res.json({ success: true, data: updated });
    } catch (e) { next(e); }
  }
}







