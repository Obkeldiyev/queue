import { Response, NextFunction } from "express";
import prisma from "../prisma/client";
import type { AuthRequest } from "@middlewares";

export class AnalyticsController {
  // GET /analytics/dashboard
  static async dashboard(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user?.type === "company_user" ? req.user.companyId : (req.query.company_id as string | undefined);
      const branchId = req.query.branch_id as string | undefined;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const where: Record<string, unknown> = { created_at: { gte: today, lt: tomorrow } };
      if (branchId) where.branch_id = branchId;

      const [waiting, called, serving, completed, noShow, online, kiosk] = await Promise.all([
        prisma.ticket.count({ where: { ...where, status: "WAITING" } }),
        prisma.ticket.count({ where: { ...where, status: "CALLED" } }),
        prisma.ticket.count({ where: { ...where, status: "SERVING" } }),
        prisma.ticket.count({ where: { ...where, status: "COMPLETED" } }),
        prisma.ticket.count({ where: { ...where, status: "NO_SHOW" } }),
        prisma.ticket.count({ where: { ...where, is_online: true } }),
        prisma.ticket.count({ where: { ...where, is_online: false } }),
      ]);

      // Hourly breakdown — simple approach works on any PG version
      const hourlyRaw = await prisma.ticket.findMany({
        where: { ...where },
        select: { created_at: true },
      });
      const hourlyMap: Record<number, number> = {};
      hourlyRaw.forEach((t: { created_at: Date }) => {
        const hr = new Date(t.created_at).getHours();
        hourlyMap[hr] = (hourlyMap[hr] ?? 0) + 1;
      });
      const hourlyTickets = Object.entries(hourlyMap).map(([hr, count]) => ({ hour: parseInt(hr), count })).sort((a, b) => a.hour - b.hour);

      // Average wait time
      const avgWait = await prisma.ticket.aggregate({
        where: { ...where, status: "COMPLETED", wait_time_sec: { not: null } },
        _avg: { wait_time_sec: true },
      });

      const rangeStart = new Date();
      rangeStart.setDate(rangeStart.getDate() - 30);
      const recentCompletedTickets = await prisma.ticket.findMany({
        where: {
          status: "COMPLETED",
          completed_at: { gte: rangeStart },
          served_by_id: { not: null },
          ...(branchId ? { branch_id: branchId } : {}),
        },
        select: {
          served_by_id: true,
          service_time_sec: true,
          wait_time_sec: true,
        },
      });

      const operatorIds = [...new Set(recentCompletedTickets.map((t: { served_by_id: string | null }) => t.served_by_id).filter(Boolean) as string[])];
      const operators = operatorIds.length > 0 ? await prisma.companyUser.findMany({
        where: { id: { in: operatorIds } },
        select: { id: true, first_name: true, last_name: true },
      }) : [];
      const operatorMap = new Map(operators.map((u: { id: string; first_name: string; last_name: string }) => [u.id, u]));

      const operatorPerformance = Object.values(recentCompletedTickets.reduce((acc: Record<string, any>, ticket: { served_by_id: string | null; service_time_sec: number | null; wait_time_sec: number | null }) => {
        const operatorId = ticket.served_by_id;
        if (!operatorId) return acc;
        if (!acc[operatorId]) {
          const operator = operatorMap.get(operatorId);
          acc[operatorId] = {
            operator_id: operatorId,
            operator_name: operator ? `${operator.first_name} ${operator.last_name}`.trim() : "Operator",
            completed_tickets: 0,
            service_seconds: 0,
            wait_seconds: 0,
          };
        }
        acc[operatorId].completed_tickets += 1;
        acc[operatorId].service_seconds += ticket.service_time_sec ?? 0;
        acc[operatorId].wait_seconds += ticket.wait_time_sec ?? 0;
        return acc;
      }, {})).map((entry: { operator_id: string; completed_tickets: number; service_seconds: number; wait_seconds: number }) => ({
        ...entry,
        avg_service_sec: Math.round(entry.service_seconds / entry.completed_tickets),
        avg_wait_sec: Math.round(entry.wait_seconds / entry.completed_tickets),
      })).sort((a, b) => b.completed_tickets - a.completed_tickets);

      const recentSessions = await prisma.counterSession.findMany({
        where: {
          started_at: { gte: rangeStart },
          ...(branchId ? { counter: { branch_id: branchId } } : {}),
        },
        include: {
          company_user: { select: { id: true, first_name: true, last_name: true } },
        },
      });

      const employeeHours = Object.values(recentSessions.reduce((acc: Record<string, any>, session: { company_user_id: string; started_at: Date; ended_at: Date | null; company_user: { id: string; first_name: string; last_name: string } }) => {
        const employeeId = session.company_user_id;
        if (!acc[employeeId]) {
          acc[employeeId] = {
            employee_id: employeeId,
            employee_name: `${session.company_user.first_name} ${session.company_user.last_name}`.trim(),
            sessions_count: 0,
            minutes_worked: 0,
            tickets_served: 0,
          };
        }
        acc[employeeId].sessions_count += 1;
        const end = session.ended_at ?? new Date();
        acc[employeeId].minutes_worked += Math.max(0, Math.round((end.getTime() - session.started_at.getTime()) / 60000));
        return acc;
      }, {})).map((entry: { employee_id: string; employee_name: string; sessions_count: number; minutes_worked: number; tickets_served: number }) => ({
        ...entry,
        hours_worked: Math.round(entry.minutes_worked / 60),
      }));

      const employeeTicketCounts = recentCompletedTickets.reduce((acc: Record<string, number>, ticket: { served_by_id: string | null }) => {
        if (!ticket.served_by_id) return acc;
        acc[ticket.served_by_id] = (acc[ticket.served_by_id] ?? 0) + 1;
        return acc;
      }, {});

      const employeeHoursWithTickets = employeeHours.map((entry: { employee_id: string; employee_name: string; sessions_count: number; hours_worked: number }) => ({
        ...entry,
        tickets_served: employeeTicketCounts[entry.employee_id] ?? 0,
      })).sort((a, b) => b.hours_worked - a.hours_worked);

      res.json({
        success: true,
        data: {
          today: { waiting, called, serving, completed, noShow, online, kiosk },
          hourly: hourlyTickets,
          avg_wait_sec: avgWait._avg.wait_time_sec,
          operatorPerformance,
          employeeHours: employeeHoursWithTickets,
        },
      });
    } catch (e) { next(e); }
  }

  // GET /analytics/snapshots
  static async snapshots(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user?.type === "company_user" ? req.user.companyId : (req.query.company_id as string | undefined);
      const days = parseInt(req.query.days as string || "30");
      const from = new Date();
      from.setDate(from.getDate() - days);

      const snapshots = await prisma.analyticsSnapshot.findMany({
        where: {
          company_id: companyId,
          snapshot_date: { gte: from },
          ...(req.query.branch_id ? { branch_id: req.query.branch_id as string } : {}),
        },
        orderBy: { snapshot_date: "asc" },
      });
      res.json({ success: true, data: snapshots });
    } catch (e) { next(e); }
  }

  // POST /analytics/snapshots/generate
  static async generateSnapshot(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const companyId = (req.body.company_id as string) ??
        (req.query.company_id as string | undefined);
      const date = req.body.date ? new Date(req.body.date) : new Date();
      date.setHours(0, 0, 0, 0);
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);

      const branches = await prisma.branch.findMany({
        where: companyId ? { company_id: companyId } : undefined,
        select: { id: true, company_id: true },
      });

      const results = await Promise.all(
        branches.map(async (branch: { id: string; company_id: string }) => {
          const [total, completed, cancelled, noShow, online] = await Promise.all([
            prisma.ticket.count({ where: { branch_id: branch.id, created_at: { gte: date, lt: nextDay } } }),
            prisma.ticket.count({ where: { branch_id: branch.id, created_at: { gte: date, lt: nextDay }, status: "COMPLETED" } }),
            prisma.ticket.count({ where: { branch_id: branch.id, created_at: { gte: date, lt: nextDay }, status: "CANCELLED" } }),
            prisma.ticket.count({ where: { branch_id: branch.id, created_at: { gte: date, lt: nextDay }, status: "NO_SHOW" } }),
            prisma.ticket.count({ where: { branch_id: branch.id, created_at: { gte: date, lt: nextDay }, is_online: true } }),
          ]);

          const avgWait = await prisma.ticket.aggregate({
            where: { branch_id: branch.id, created_at: { gte: date, lt: nextDay }, status: "COMPLETED" },
            _avg: { wait_time_sec: true },
          });

          return prisma.analyticsSnapshot.upsert({
            where: {
              company_id_branch_id_snapshot_date: {
                company_id: branch.company_id,
                branch_id: branch.id,
                snapshot_date: date,
              },
            },
            update: { total_tickets: total, completed_tickets: completed, cancelled_tickets: cancelled, no_show_tickets: noShow, online_tickets: online, avg_wait_time_sec: avgWait._avg.wait_time_sec ? Math.round(avgWait._avg.wait_time_sec) : null },
            create: { company_id: branch.company_id, branch_id: branch.id, snapshot_date: date, total_tickets: total, completed_tickets: completed, cancelled_tickets: cancelled, no_show_tickets: noShow, online_tickets: online, avg_wait_time_sec: avgWait._avg.wait_time_sec ? Math.round(avgWait._avg.wait_time_sec) : null },
          });
        })
      );

      res.json({ success: true, data: results });
    } catch (e) { next(e); }
  }

  // GET /analytics/operator/:id
  static async operatorStats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { from, to, branch_id, days } = req.query;
      const fromDate = from ? new Date(from as string) : new Date(Date.now() - (parseInt(days as string || "30") * 86400000));
      const toDate = to ? new Date(to as string) : new Date();

      const served = await prisma.ticket.count({
        where: {
          served_by_id: req.params.id,
          status: "COMPLETED",
          completed_at: { gte: fromDate, lte: toDate },
          ...(branch_id ? { branch_id: branch_id as string } : {}),
        },
      });

      const avgService = await prisma.ticket.aggregate({
        where: {
          served_by_id: req.params.id,
          status: "COMPLETED",
          service_time_sec: { not: null },
          completed_at: { gte: fromDate, lte: toDate },
          ...(branch_id ? { branch_id: branch_id as string } : {}),
        },
        _avg: { service_time_sec: true },
      });

      const sessions = await prisma.counterSession.findMany({
        where: {
          company_user_id: req.params.id,
          started_at: { gte: fromDate, lte: toDate },
          ...(branch_id ? { counter: { branch_id: branch_id as string } } : {}),
        },
      });

      const workMinutes = sessions.reduce((sum, session) => {
        const end = session.ended_at ?? new Date();
        return sum + Math.max(0, Math.round((end.getTime() - session.started_at.getTime()) / 60000));
      }, 0);

      const completedToday = await prisma.ticket.count({
        where: {
          served_by_id: req.params.id,
          status: "COMPLETED",
          completed_at: { gte: new Date(new Date().setHours(0, 0, 0, 0)), lte: new Date() },
          ...(branch_id ? { branch_id: branch_id as string } : {}),
        },
      });

      res.json({
        success: true,
        data: {
          served,
          avg_service_sec: avgService._avg.service_time_sec,
          work_minutes: workMinutes,
          sessions_count: sessions.length,
          completed_today: completedToday,
        },
      });
    } catch (e) { next(e); }
  }
}





