import { Response, NextFunction } from "express";
import prisma from "../prisma/client";
import { ErrorHandler } from "@errors";
import { createAuditLog } from "@utils";
import { broadcast } from "../utils/websocket";
import { dayBoundary } from "../utils/daily-reset";
import type {
  CreateQueueGroupDto,
  UpdateQueueGroupDto,
  IssueTicketDto,
  CallNextDto,
  TransferTicketDto,
} from "../dto/queue.dto";
import type { AuthRequest } from "@middlewares";


function jsonStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((id): id is string => typeof id === "string");
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
    } catch {
      return [];
    }
  }
  return [];
}

async function operatorAccess(userId: string, companyId: string, branchId?: string) {
  const operator = await prisma.companyUser.findUnique({
    where: { id: userId },
    select: { allowed_service_ids: true, allowed_menu_ids: true } as any,
  });
  const serviceAccessValue = (operator as any)?.allowed_service_ids;
  const menuAccessValue = (operator as any)?.allowed_menu_ids;
  const isRestricted =
    serviceAccessValue !== null &&
    serviceAccessValue !== undefined ||
    menuAccessValue !== null &&
    menuAccessValue !== undefined;
  const allowedServicesOrQueues = jsonStringArray(serviceAccessValue);
  const allowedMenuIds = jsonStringArray(menuAccessValue);
  if (!isRestricted) {
    return { isRestricted: false, queueIds: null as string[] | null, menuIds: [] as string[], directQueueIds: [] as string[] };
  }
  if (!allowedServicesOrQueues.length && !allowedMenuIds.length) {
    return { isRestricted: true, queueIds: [] as string[], menuIds: [] as string[], directQueueIds: [] as string[] };
  }

  const menuQueueIds = new Set<string>();
  const permittedMenuIds = new Set<string>();
  if (allowedMenuIds.length) {
    const menus = await prisma.menu.findMany({
      where: { company_id: companyId },
      select: { id: true, parent_id: true, queue_group_id: true },
    });
    const children = new Map<string, typeof menus[number][]>();
    for (const menu of menus) {
      if (!menu.parent_id) continue;
      const list = children.get(menu.parent_id) || [];
      list.push(menu);
      children.set(menu.parent_id, list);
    }
    const visit = (menuId: string) => {
      const menu = menus.find((m) => m.id === menuId);
      if (!menu) return;
      permittedMenuIds.add(menu.id);
      if (menu.queue_group_id) menuQueueIds.add(menu.queue_group_id);
      for (const child of children.get(menuId) || []) visit(child.id);
    };
    for (const menuId of allowedMenuIds) visit(menuId);
  }

  const directGroups = allowedServicesOrQueues.length
    ? await prisma.queueGroup.findMany({
        where: {
          company_id: companyId,
          ...(branchId ? { branch_id: branchId } : {}),
          OR: [{ id: { in: allowedServicesOrQueues } }, { service_id: { in: allowedServicesOrQueues } }],
        },
        select: { id: true },
      })
    : [];
  const menuGroups = menuQueueIds.size
    ? await prisma.queueGroup.findMany({
        where: {
          company_id: companyId,
          ...(branchId ? { branch_id: branchId } : {}),
          id: { in: Array.from(menuQueueIds) },
        },
        select: { id: true },
      })
    : [];
  const directQueueIds = directGroups.map((g) => g.id);
  const queueIds = Array.from(new Set([...directQueueIds, ...menuGroups.map((g) => g.id)]));
  return { isRestricted: true, queueIds, menuIds: Array.from(permittedMenuIds), directQueueIds };
}

async function allowedQueueIdsForOperator(userId: string, companyId: string, branchId?: string): Promise<string[] | null> {
  return (await operatorAccess(userId, companyId, branchId)).queueIds;
}

function generateTicketNumber(
  format: string,
  seq: number,
  prefix: string,
): string {
  // Format: "{PREFIX}{NUM:3}" or "LOAN-{NUM:4}" etc.
  return format
    .replace(/\{PREFIX\}/g, prefix)
    .replace(/\{NUM:(\d+)\}/g, (_m, digits) =>
      String(seq).padStart(parseInt(digits), "0"),
    );
}

export class QueueController {
  // ---- Queue Groups ----

  // GET /queues
  static async listGroups(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const companyId =
        req.user?.type === "company_user"
          ? req.user.companyId
          : (req.query.company_id as string | undefined);
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
    } catch (e) {
      next(e);
    }
  }

  // POST /queues
  static async createGroup(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const body = req.body as CreateQueueGroupDto & { company_id?: string };
      const companyId =
        req.user?.type === "company_user"
          ? req.user.companyId
          : (body.company_id ?? undefined);
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
        req,
        companyId,
        companyUserId:
          req.user?.type === "company_user" ? req.user.sub : undefined,
        action: "CREATE",
        entityType: "QueueGroup",
        entityId: group.id,
      });

      res.status(201).json({ success: true, data: group });
    } catch (e) {
      next(e);
    }
  }

  // GET /queues/:id
  static async findOneGroup(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) {
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
    } catch (e) {
      next(e);
    }
  }

  // PATCH /queues/:id
  static async updateGroup(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const body = req.body as UpdateQueueGroupDto;
      const existing = await prisma.queueGroup.findUnique({
        where: { id: req.params.id },
      });
      if (!existing)
        return next(new ErrorHandler("Queue group not found", 404));

      const group = await prisma.queueGroup.update({
        where: { id: req.params.id },
        data: {
          name_uz: body.name_uz,
          name_ru: body.name_ru,
          name_en: body.name_en,
          prefix: body.prefix,
          ...(Object.prototype.hasOwnProperty.call(body, "service_id") ? { service_id: (body as any).service_id || null } : {}),
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
        req,
        companyId: group.company_id,
        companyUserId:
          req.user?.type === "company_user" ? req.user.sub : undefined,
        action: "UPDATE",
        entityType: "QueueGroup",
        entityId: group.id,
      });

      res.json({ success: true, data: group });
    } catch (e) {
      next(e);
    }
  }

  // DELETE /queues/:id
  static async removeGroup(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const existing = await prisma.queueGroup.findUnique({
        where: { id: req.params.id },
      });
      if (!existing)
        return next(new ErrorHandler("Queue group not found", 404));

      // Delete in dependency order to avoid FK violations
      // 1. Ticket history rows (references tickets)
      await prisma.ticketHistory.deleteMany({
        where: { ticket: { queue_group_id: req.params.id } },
      });
      // 2. Tickets themselves
      await prisma.ticket.deleteMany({
        where: { queue_group_id: req.params.id },
      });
      // 3. Counter ↔ queue-group assignments
      await prisma.counterQueue.deleteMany({
        where: { queue_group_id: req.params.id },
      });
      // 4. Menu items that link to this queue group (set to null, keep the menu item)
      await prisma.menu.updateMany({
        where: { queue_group_id: req.params.id },
        data: { queue_group_id: null },
      });
      // 5. Finally delete the queue group
      await prisma.queueGroup.delete({ where: { id: req.params.id } });

      res.json({ success: true, message: "Queue group deleted" });
    } catch (e) {
      next(e);
    }
  }

  // ---- Tickets ----

  // POST /queues/tickets/issue  — issue a ticket
  static async issueTicket(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const body = req.body as IssueTicketDto;
      const ticket = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM queue_groups WHERE id = ${body.queue_group_id}::uuid FOR UPDATE`;
        const group = await tx.queueGroup.findUnique({
          where: { id: body.queue_group_id },
          include: { company: { select: { timezone: true } } },
        });
        if (!group) throw new ErrorHandler("Queue group not found", 404);
        if (!group.is_active)
          throw new ErrorHandler("Queue is not active", 400);
        if (body.is_online && !group.online_enabled) {
          throw new ErrorHandler(
            "Online queue not enabled for this group",
            400,
          );
        }
        if (body.branch_id && body.branch_id !== group.branch_id) {
          throw new ErrorHandler(
            "Ticket branch does not match this queue",
            400,
          );
        }
        let issuingMenuId: string | null = null;
        if (body.menu_id) {
          const menu = await tx.menu.findFirst({
            where: { id: body.menu_id, company_id: group.company_id, queue_group_id: group.id },
            select: { id: true },
          });
          if (!menu) throw new ErrorHandler("Invalid menu for this queue", 400);
          issuingMenuId = menu.id;
        }

        const startOfDay = dayBoundary(
          new Date(),
          group.company.timezone || "Asia/Tashkent",
        );
        const todayCount = await tx.ticket.count({
          where: { queue_group_id: group.id, created_at: { gte: startOfDay } },
        });
        if (group.daily_limit && todayCount >= group.daily_limit) {
          throw new ErrorHandler("Daily queue limit reached", 429);
        }

        const seq = todayCount + 1;
        const ticketNumber = generateTicketNumber(
          group.number_format,
          seq,
          group.prefix,
        );
        const created = await tx.ticket.create({
          data: {
            queue_group_id: group.id,
            menu_id: issuingMenuId,
            branch_id: group.branch_id,
            customer_id: body.customer_id,
            ticket_number: ticketNumber,
            priority: body.priority ?? 0,
            notes: body.notes,
            is_online: body.is_online ?? false,
          },
          include: {
            queue_group: { include: { service: true } },
            issued_menu: true,
            branch: { select: { id: true, name_uz: true } },
          },
        });
        await tx.ticketHistory.create({
          data: {
            ticket_id: created.id,
            to_status: "WAITING",
            changed_type: body.customer_id ? "customer" : "kiosk",
          },
        });
        await tx.queueGroup.update({
          where: { id: group.id },
          data: { current_number: seq },
        });
        return created;
      });

      broadcast({
        event: "ticket:issued",
        branchId: ticket.branch_id,
        companyId: ticket.queue_group.company_id,
        payload: {
          ticket_number: ticket.ticket_number,
          queue_group_id: ticket.queue_group_id,
          ticket_id: ticket.id,
        },
      });

      await createAuditLog({
        req,
        companyId: ticket.queue_group.company_id,
        branchId: ticket.branch_id,
        action: "PRINT_TICKET",
        entityType: "Ticket",
        entityId: ticket.id,
      });

      res.status(201).json({ success: true, data: ticket });
    } catch (e) {
      next(e);
    }
  }

  // POST /queues/tickets/call-next
  static async callNext(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const counterId = String(req.body.counter_id || "");
      const ticket = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM counters WHERE id = ${counterId}::uuid FOR UPDATE`;
        const counter = await tx.counter.findFirst({
          where: {
            id: counterId,
            company_id: req.user!.companyId,
            is_active: true,
          },
          include: { queue_groups: { include: { queue_group: true } } },
        });
        if (!counter) throw new ErrorHandler("Counter unavailable", 404);
        const session = await tx.counterSession.findFirst({
          where: {
            counter_id: counterId,
            company_user_id: req.user!.sub,
            is_active: true,
          },
        });
        if (!session)
          throw new ErrorHandler("Open your counter session first", 409);
        if (
          await tx.ticket.findFirst({
            where: {
              counter_id: counterId,
              status: "SERVING",
            },
          })
        )
          throw new ErrorHandler(
            "Complete or transfer the current ticket first",
            409,
          );

        const previousCalled = await tx.ticket.findMany({
          where: {
            counter_id: counterId,
            status: "CALLED",
          },
          orderBy: { called_at: "asc" },
          select: { id: true },
        });
        if (previousCalled.length) {
          const idsToClose = previousCalled.map((t) => t.id);
          const changed = await tx.ticket.updateMany({
            where: { id: { in: idsToClose }, status: "CALLED" },
            data: { status: "NO_SHOW", completed_at: new Date() },
          });
          if (changed.count) {
            await tx.ticketHistory.createMany({
              data: idsToClose.map((ticket_id) => ({
                ticket_id,
                from_status: "CALLED",
                to_status: "NO_SHOW",
                changed_by: req.user!.sub,
                changed_type: "company_user",
                note: "Auto no-show when operator called next ticket",
              })),
            });
          }
        }
        const access = await operatorAccess(req.user!.sub, req.user!.companyId!, counter.branch_id);
        const ids = counter.queue_groups
          .filter((q) => q.queue_group.is_active && (!access.isRestricted || access.queueIds!.includes(q.queue_group_id)))
          .map((q) => q.queue_group_id);
        if (!ids.length)
          throw new ErrorHandler("No permitted services at this counter", 403);
        for (let attempt = 0; attempt < 5; attempt++) {
          const accessFilters = access.isRestricted
            ? [
                ...(access.directQueueIds.length ? [{ queue_group_id: { in: access.directQueueIds } }] : []),
                ...(access.menuIds.length ? [{ menu_id: { in: access.menuIds } }] : []),
              ]
            : [];
          const candidate = await tx.ticket.findFirst({
            where: {
              queue_group_id: { in: ids },
              status: "WAITING",
              OR: [{ counter_id: null }, { counter_id: counterId }],
              ...(accessFilters.length ? { AND: [{ OR: accessFilters }] } : {}),
            },
            orderBy: [{ priority: "desc" }, { created_at: "asc" }],
          });
          if (!candidate) throw new ErrorHandler("No tickets waiting", 404);
          const called = new Date();
          const claimed = await tx.ticket.updateMany({
            where: { id: candidate.id, status: "WAITING" },
            data: {
              status: "CALLED",
              counter_id: counterId,
              counter_session_id: session.id,
              served_by_id: req.user!.sub,
              called_at: called,
              serving_started_at: null,
            },
          });
          if (!claimed.count) continue;
          await tx.ticketHistory.create({
            data: {
              ticket_id: candidate.id,
              from_status: "WAITING",
              to_status: "CALLED",
              changed_by: req.user!.sub,
              changed_type: "company_user",
            },
          });
          return tx.ticket.findUniqueOrThrow({
            where: { id: candidate.id },
            include: {
              queue_group: { include: { service: true } },
              issued_menu: true,
              counter: true,
            },
          });
        }
        throw new ErrorHandler("Queue changed, please retry", 409);
      });
      broadcast({
        event: "ticket:called",
        branchId: ticket.branch_id,
        companyId: ticket.queue_group.company_id,
        payload: {
          ticket_id: ticket.id,
          ticket_number: ticket.ticket_number,
          counter_id: ticket.counter_id,
          counter_name: ticket.counter?.name_uz,
        },
      });
      await createAuditLog({
        req,
        companyId: ticket.queue_group.company_id,
        branchId: ticket.branch_id,
        companyUserId: req.user!.sub,
        action: "CALL_NEXT",
        entityType: "Ticket",
        entityId: ticket.id,
      });
      res.json({ success: true, data: ticket });
    } catch (e) {
      next(e);
    }
  }

  // GET /queues/tickets — list tickets
  static async listTickets(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const {
        branch_id,
        queue_group_id,
        queue_group_ids,
        menu_id,
        menu_ids,
        status,
        page = "1",
        limit = "50",
      } = req.query;
      if (!branch_id && !queue_group_id)
        return next(
          new ErrorHandler("branch_id or queue_group_id required", 400),
        );
      const currentPage = Math.max(1, Number(page) || 1);
      const pageSize = Math.min(200, Math.max(1, Number(limit) || 50));
      const skip = (currentPage - 1) * pageSize;
      const where: Record<string, unknown> = {};
      if (branch_id) where.branch_id = branch_id;
      if (queue_group_id) where.queue_group_id = queue_group_id;
      if (queue_group_ids) {
        const ids = String(queue_group_ids).split(",").map((id) => id.trim()).filter(Boolean);
        if (ids.length) where.queue_group_id = { in: ids };
      }
      if (menu_id) where.menu_id = menu_id;
      if (menu_ids) {
        const ids = String(menu_ids).split(",").map((id) => id.trim()).filter(Boolean);
        if (ids.length) where.menu_id = { in: ids };
      }
      if (req.user?.type === "company_user" && req.user?.companyId) {
        const permittedQueueIds = await allowedQueueIdsForOperator(req.user.sub, req.user.companyId, branch_id as string | undefined);
        if (permittedQueueIds !== null) {
          if (queue_group_id && !permittedQueueIds.includes(String(queue_group_id))) {
            where.queue_group_id = { in: [] };
          } else if (!queue_group_id) {
            where.queue_group_id = { in: permittedQueueIds };
          }
        }
      }
      if (status) {
        const statuses = String(status)
          .split(",")
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean);
        where.status = statuses.length > 1 ? { in: statuses } : statuses[0];
      }

      const [tickets, total] = await Promise.all([
        prisma.ticket.findMany({
          where,
          skip,
          take: pageSize,
          orderBy:
            String(status || "").toUpperCase() === "WAITING"
              ? { created_at: "asc" }
              : { updated_at: "desc" },
          include: {
            queue_group: { include: { service: true } },
            issued_menu: true,
            counter: {
              select: {
                id: true,
                name_uz: true,
                name_ru: true,
                name_en: true,
                number: true,
              },
            },
          },
        }),
        prisma.ticket.count({ where }),
      ]);
      res.json({
        success: true,
        data: tickets,
        meta: { total, page: currentPage, limit: pageSize },
      });
    } catch (e) {
      next(e);
    }
  }

  // GET /queues/tickets/:id
  static async findOneTicket(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const ticket = await prisma.ticket.findUnique({
        where: { id: req.params.id },
        include: {
          queue_group: { include: { service: true } },
          counter: true,
          customer: true,
          history: { orderBy: { created_at: "asc" } },
        },
      });
      if (!ticket) return next(new ErrorHandler("Ticket not found", 404));
      res.json({ success: true, data: ticket });
    } catch (e) {
      next(e);
    }
  }

  // PATCH /queues/tickets/:id/complete
  static async completeTicket(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const ticket = await prisma.ticket.findUnique({
        where: { id: req.params.id },
        include: { queue_group: true },
      });
      if (!ticket) return next(new ErrorHandler("Ticket not found", 404));
      if (!["CALLED", "SERVING"].includes(ticket.status)) {
        return next(new ErrorHandler("Ticket not in callable state", 400));
      }

      const now = new Date();
      const waitTimeSec = ticket.called_at
        ? Math.max(
            0,
            Math.round(
              (ticket.called_at.getTime() - ticket.created_at.getTime()) / 1000,
            ),
          )
        : undefined;
      const serviceStart = ticket.serving_started_at ?? ticket.called_at ?? now;
      const serviceTimeSec = Math.max(
        0,
        Math.round((now.getTime() - serviceStart.getTime()) / 1000),
      );

      const updated = await prisma.$transaction(async (tx) => {
        const changed = await tx.ticket.updateMany({
          where: { id: ticket.id, status: ticket.status },
          data: {
            status: "COMPLETED",
            completed_at: now,
            wait_time_sec: waitTimeSec,
            service_time_sec: serviceTimeSec,
            served_by_id:
              req.user?.type === "company_user"
                ? req.user.sub
                : ticket.served_by_id,
          },
        });
        if (!changed.count)
          throw new ErrorHandler("Ticket was already updated", 409);
        await tx.ticketHistory.create({
          data: {
            ticket_id: ticket.id,
            from_status: ticket.status,
            to_status: "COMPLETED",
            changed_by: req.user?.sub,
            changed_type: "company_user",
          },
        });
        return tx.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
      });

      broadcast({
        event: "ticket:completed",
        branchId: ticket.branch_id,
        companyId: ticket.queue_group.company_id,
        payload: { ticket_id: ticket.id, ticket_number: updated.ticket_number },
      });

      await createAuditLog({
        req,
        companyId: ticket.queue_group.company_id,
        branchId: ticket.branch_id,
        companyUserId:
          req.user?.type === "company_user" ? req.user.sub : undefined,
        action: "COMPLETE_SERVICE",
        entityType: "Ticket",
        entityId: ticket.id,
      });

      res.json({ success: true, data: updated });
    } catch (e) {
      next(e);
    }
  }

  // PATCH /queues/tickets/:id/recall
  static async recallTicket(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const ticket = await prisma.ticket.findUnique({
        where: { id: req.params.id },
      });
      if (!ticket) return next(new ErrorHandler("Ticket not found", 404));

      if (!["CALLED", "SERVING"].includes(ticket.status))
        return next(
          new ErrorHandler("Only active tickets may be recalled", 409),
        );
      const updated = await prisma.ticket.update({
        where: { id: ticket.id },
        data: { status: "CALLED" },
      });

      await prisma.ticketHistory.create({
        data: {
          ticket_id: ticket.id,
          from_status: ticket.status,
          to_status: "CALLED",
          changed_by: req.user?.sub,
          note: "recall",
        },
      });

      const counter = ticket.counter_id
        ? await prisma.counter.findUnique({ where: { id: ticket.counter_id } })
        : null;
      broadcast({
        event: "ticket:called",
        branchId: ticket.branch_id,
        payload: {
          ticket_id: ticket.id,
          ticket_number: ticket.ticket_number,
          counter_id: ticket.counter_id,
          counter_name: counter?.name_uz,
        },
      });
      res.json({ success: true, data: updated });
    } catch (e) {
      next(e);
    }
  }

  // PATCH /queues/tickets/:id/serve  — CALLED → SERVING
  static async serveTicket(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const ticket = await prisma.ticket.findUnique({
        where: { id: req.params.id },
      });
      if (!ticket) return next(new ErrorHandler("Ticket not found", 404));
      if (ticket.status !== "CALLED") {
        return next(
          new ErrorHandler(`Ticket is ${ticket.status}, not CALLED`, 400),
        );
      }
      const now = new Date();
      const updated = await prisma.$transaction(async (tx) => {
        if (ticket.counter_id) {
          const serving = await tx.ticket.findFirst({
            where: {
              counter_id: ticket.counter_id,
              status: "SERVING",
              id: { not: ticket.id },
            },
            select: { id: true, ticket_number: true },
          });
          if (serving) {
            throw new ErrorHandler("Complete the active ticket before starting another one", 409);
          }
        }
        const changed = await tx.ticket.updateMany({
          where: { id: ticket.id, status: "CALLED" },
          data: {
            status: "SERVING",
            serving_started_at: now,
            served_by_id:
              req.user?.type === "company_user"
                ? req.user.sub
                : ticket.served_by_id,
          },
        });
        if (!changed.count) throw new ErrorHandler("Ticket was already updated", 409);
        await tx.ticketHistory.create({
          data: {
            ticket_id: ticket.id,
            from_status: "CALLED",
            to_status: "SERVING",
            changed_by: req.user?.sub,
            changed_type: "company_user",
          },
        });
        return tx.ticket.findUniqueOrThrow({
          where: { id: ticket.id },
          include: { queue_group: { include: { service: true } }, counter: true },
        });
      });
      broadcast({
        event: "ticket:serving",
        branchId: updated.branch_id,
        companyId: updated.queue_group?.company_id,
        payload: {
          ticket_id: updated.id,
          ticket_number: updated.ticket_number,
          counter_id: updated.counter_id,
          counter_name: updated.counter?.name_uz,
        },
      });
      res.json({ success: true, data: updated });
    } catch (e) {
      next(e);
    }
  }

  // POST /queues/tickets/:id/assign
  static async assignTicket(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const ticketId = req.params.id;
      const { counter_id, served_by_id } = req.body as {
        counter_id?: string;
        served_by_id?: string;
      };

      const ticket = await prisma.ticket.findUnique({
        where: { id: ticketId },
      });
      if (!ticket) return next(new ErrorHandler("Ticket not found", 404));

      // Only assign waiting tickets (but allow reassigning CALLED => reassignment)
      if (!["WAITING", "CALLED"].includes(ticket.status)) {
        return next(
          new ErrorHandler(
            "Ticket cannot be assigned in its current state",
            400,
          ),
        );
      }

      const counter = counter_id
        ? await prisma.counter.findUnique({ where: { id: counter_id } })
        : null;

      const now = new Date();
      const updated = await prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          status: "CALLED",
          counter_id: counter ? counter.id : undefined,
          counter_session_id: undefined,
          served_by_id:
            served_by_id ??
            (req.user?.type === "company_user" ? req.user.sub : undefined),
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
        req,
        companyId: updated.queue_group.company_id,
        branchId: updated.branch_id,
        companyUserId:
          req.user?.type === "company_user" ? req.user.sub : undefined,
        action: "CALL_NEXT",
        entityType: "Ticket",
        entityId: updated.id,
        metadata: {
          counter_id: updated.counter?.id,
          ticket_number: updated.ticket_number,
        },
      });

      res.json({ success: true, data: updated });
    } catch (e) {
      next(e);
    }
  }

  // PATCH /queues/tickets/:id/no-show
  static async noShow(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ticket = await prisma.ticket.findUnique({
        where: { id: req.params.id },
        include: { queue_group: true },
      });
      if (!ticket) return next(new ErrorHandler("Ticket not found", 404));
      if (!["CALLED", "SERVING"].includes(ticket.status))
        return next(
          new ErrorHandler("Only active tickets may be marked no-show", 409),
        );

      const updated = await prisma.$transaction(async (tx) => {
        const changed = await tx.ticket.updateMany({
          where: { id: ticket.id, status: ticket.status },
          data: { status: "NO_SHOW", completed_at: new Date() },
        });
        if (!changed.count)
          throw new ErrorHandler("Ticket was already updated", 409);
        await tx.ticketHistory.create({
          data: {
            ticket_id: ticket.id,
            from_status: ticket.status,
            to_status: "NO_SHOW",
            changed_by: req.user?.sub,
          },
        });
        return tx.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
      });

      broadcast({
        event: "ticket:no_show",
        branchId: ticket.branch_id,
        companyId: ticket.queue_group.company_id,
        payload: { ticket_id: ticket.id, ticket_number: ticket.ticket_number },
      });
      res.json({ success: true, data: updated });
    } catch (e) {
      next(e);
    }
  }

  // PATCH /queues/tickets/:id/cancel
  static async cancelTicket(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const ticket = await prisma.ticket.findUnique({
        where: { id: req.params.id },
        include: { queue_group: true },
      });
      if (!ticket) return next(new ErrorHandler("Ticket not found", 404));
      if (["COMPLETED", "CANCELLED", "NO_SHOW"].includes(ticket.status))
        return next(new ErrorHandler("Ticket is already closed", 409));

      const updated = await prisma.$transaction(async (tx) => {
        const changed = await tx.ticket.updateMany({
          where: { id: ticket.id, status: ticket.status },
          data: { status: "CANCELLED", completed_at: new Date() },
        });
        if (!changed.count)
          throw new ErrorHandler("Ticket was already updated", 409);
        await tx.ticketHistory.create({
          data: {
            ticket_id: ticket.id,
            from_status: ticket.status,
            to_status: "CANCELLED",
            changed_by: req.user?.sub,
          },
        });
        return tx.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
      });

      broadcast({
        event: "ticket:cancelled",
        branchId: ticket.branch_id,
        companyId: ticket.queue_group.company_id,
        payload: { ticket_id: ticket.id, ticket_number: ticket.ticket_number },
      });
      res.json({ success: true, data: updated });
    } catch (e) {
      next(e);
    }
  }

  // PATCH /queues/tickets/:id/transfer
  static async transferTicket(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const body = req.body as TransferTicketDto;
      const ticket = await prisma.ticket.findUnique({
        where: { id: req.params.id },
      });
      if (!ticket) return next(new ErrorHandler("Ticket not found", 404));
      if (!["CALLED", "SERVING"].includes(ticket.status))
        return next(
          new ErrorHandler("Only active tickets can be transferred", 409),
        );
      if (!body.to_counter_id && !body.to_queue_group_id)
        return next(new ErrorHandler("Choose a destination", 400));
      const destination = body.to_counter_id
        ? await prisma.counter.findUnique({
            where: { id: body.to_counter_id },
            include: { queue_groups: true },
          })
        : null;
      if (
        body.to_counter_id &&
        (!destination ||
          destination.branch_id !== ticket.branch_id ||
          destination.company_id !== req.user?.companyId ||
          destination.id === ticket.counter_id)
      )
        return next(
          new ErrorHandler("Choose another counter in this branch", 400),
        );
      const queueId =
        body.to_queue_group_id ||
        (destination?.queue_groups.some(
          (q) => q.queue_group_id === ticket.queue_group_id,
        )
          ? ticket.queue_group_id
          : destination?.queue_groups[0]?.queue_group_id) ||
        ticket.queue_group_id;
      const queue = await prisma.queueGroup.findUnique({
        where: { id: queueId },
      });
      if (
        !queue ||
        queue.branch_id !== ticket.branch_id ||
        queue.company_id !== req.user?.companyId ||
        !queue.is_active
      )
        return next(new ErrorHandler("Destination queue unavailable", 400));
      if (
        destination &&
        !destination.queue_groups.some((q) => q.queue_group_id === queueId)
      )
        return next(new ErrorHandler("Counter cannot serve this queue", 400));

      const updated = await prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          status: "WAITING",
          counter_id: body.to_counter_id ?? null,
          queue_group_id: queueId,
          counter_session_id: null,
          served_by_id: null,
          called_at: null,
          serving_started_at: null,
          notes: body.notes ?? ticket.notes,
        },
      });

      await prisma.ticketHistory.create({
        data: {
          ticket_id: ticket.id,
          from_status: ticket.status,
          to_status: "WAITING",
          changed_by: req.user?.sub,
          note: `Transferred to counter ${body.to_counter_id ?? "—"}`,
        },
      });

      await createAuditLog({
        req,
        companyId: queue.company_id,
        branchId: ticket.branch_id,
        companyUserId:
          req.user?.type === "company_user" ? req.user.sub : undefined,
        action: "TRANSFER",
        entityType: "Ticket",
        entityId: ticket.id,
      });

      broadcast({
        event: "ticket:transferred",
        branchId: ticket.branch_id,
        companyId: queue.company_id,
        payload: { ticket_id: ticket.id, counter_id: body.to_counter_id },
      });
      res.json({ success: true, data: updated });
    } catch (e) {
      next(e);
    }
  }
}
