import { Router, Response, NextFunction } from "express";
import crypto from "crypto";
import prisma from "../prisma/client";
import {
  authenticate,
  requireCompanyUser,
  requireCompanyAdmin,
  AuthRequest,
} from "../middlewares/auth.middleware";
import { ErrorHandler } from "../errors";
import { hashPassword, verifyPassword, createAuditLog } from "../utils";
import { broadcast } from "../utils/websocket";
import { resetBranch } from "../utils/daily-reset";
const router = Router();
const admin = (req: AuthRequest) =>
  req.user?.roleTypes?.some((r) =>
    ["COMPANY_ADMIN", "BRANCH_MANAGER", "SUPERVISOR"].includes(r),
  );
const wrap =
  (fn: (req: AuthRequest, res: Response) => Promise<unknown>) =>
  (req: AuthRequest, res: Response, next: NextFunction) => {
    void fn(req, res).catch(next);
  };
const notify = (companyId: string, branchId?: string | null) =>
  broadcast({
    event: "resource:changed",
    companyId,
    branchId: branchId || undefined,
    payload: { resource: "operations" },
  });
async function conversation(req: AuthRequest, publicAccess = false) {
  const c = await prisma.serviceConversation.findUnique({
    where: publicAccess ? { token: req.params.token } : { id: req.params.id },
  });
  if (
    !c ||
    (!publicAccess &&
      (c.company_id !== req.user?.companyId ||
        (!admin(req) && c.operator_id !== req.user?.sub)))
  )
    throw new ErrorHandler("Conversation not found", 404);
  if (publicAccess && Date.now() - c.created_at.getTime() > 7 * 86400000)
    throw new ErrorHandler("This invitation has expired", 410);
  return c;
}
router.get(
  "/chat/:token",
  wrap(async (req, res) => {
    const c = await conversation(req, true);
    const messages = c.customer_name
      ? await prisma.serviceMessage.findMany({
          where: { conversation_id: c.id },
          orderBy: [{ created_at: "asc" }, { id: "asc" }],
          take: 1000,
        })
      : [];
    res.json({
      success: true,
      data: {
        id: c.id,
        customer_name: c.customer_name,
        status: c.status,
        messages,
      },
    });
  }),
);
router.post(
  "/chat/:token/join",
  wrap(async (req, res) => {
    const c = await conversation(req, true);
    const name = String(req.body.name || "").trim();
    if (name.length < 2 || name.length > 120)
      throw new ErrorHandler("Enter your name (2–120 characters)", 400);
    if (c.status === "COMPLETED")
      throw new ErrorHandler("Conversation ended", 409);
    await prisma.serviceConversation.updateMany({
      where: { id: c.id, status: "INVITED" },
      data: { customer_name: name, status: "ACTIVE" },
    });
    notify(c.company_id, c.branch_id);
    res.json({ success: true });
  }),
);
router.post(
  "/chat/:token/messages",
  wrap(async (req, res) => {
    const c = await conversation(req, true);
    const text = String(req.body.text || "").trim();
    if (!text || text.length > 4000)
      throw new ErrorHandler("Message must contain 1–4000 characters", 400);
    await prisma.$transaction(async (tx) => {
      const locked = await tx.serviceConversation.updateMany({
        where: { id: c.id, status: "ACTIVE" },
        data: { status: "ACTIVE" },
      });
      if (!locked.count)
        throw new ErrorHandler(
          "Enter your name first or start a new conversation",
          409,
        );
      await tx.serviceMessage.create({
        data: { conversation_id: c.id, sender: "customer", text },
      });
    });
    notify(c.company_id, c.branch_id);
    res.json({ success: true });
  }),
);
router.use(authenticate, requireCompanyUser);
router.post(
  "/reset",
  requireCompanyAdmin,
  wrap(async (req, res) => {
    const branch = await prisma.branch.findFirst({
      where: {
        id: String(req.body.branch_id),
        company_id: req.user!.companyId,
      },
    });
    if (!branch) throw new ErrorHandler("Branch not found", 404);
    const count = await resetBranch(branch.company_id, branch.id);
    await createAuditLog({
      req,
      companyId: branch.company_id,
      companyUserId: req.user!.sub,
      action: "UPDATE",
      entityType: "ManualQueueReset",
      entityId: branch.id,
      metadata: { count },
    });
    res.json({ success: true, data: { count } });
  }),
);
router.get(
  "/conversations",
  wrap(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const where = {
      company_id: req.user!.companyId,
      ...(!admin(req) ? { operator_id: req.user!.sub } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.serviceConversation.findMany({
        where,
        orderBy: { created_at: "desc" },
        take: 30,
        skip: (page - 1) * 30,
        select: {
          id: true,
          company_id: true,
          operator_id: true,
          branch_id: true,
          token: true,
          customer_name: true,
          channel: true,
          status: true,
          created_at: true,
          completed_at: true,
          evidence: true,
          _count: { select: { messages: true } },
        },
      }),
      prisma.serviceConversation.count({ where }),
    ]);
    res.json({
      success: true,
      data: items.map((i) => ({
        ...i,
        evidence: i.evidence
          ? { name: (i.evidence as any).name || "evidence" }
          : null,
      })),
      meta: { page, total, limit: 30 },
    });
  }),
);
router.post(
  "/conversations",
  wrap(async (req, res) => {
    const channel = String(req.body.channel || "online");
    if (!["online", "telegram", "phone", "other"].includes(channel))
      throw new ErrorHandler("Invalid channel", 400);
    const name = String(req.body.customer_name || "").trim();
    const evidence = req.body.evidence;
    if (
      channel !== "online" &&
      (!name ||
        name.length > 120 ||
        !evidence ||
        typeof evidence.data !== "string" ||
        evidence.data.length > 2800000 ||
        !/^data:(image\/(png|jpeg|webp)|application\/pdf|text\/plain);base64,/.test(
          evidence.data,
        ))
    )
      throw new ErrorHandler(
        "Customer name and a PDF, text or image evidence file (up to 2 MB) are required",
        400,
      );
    const c = await prisma.serviceConversation.create({
      data: {
        company_id: req.user!.companyId!,
        operator_id: req.user!.sub,
        branch_id: req.user!.branchId,
        token: crypto.randomBytes(32).toString("hex"),
        channel,
        customer_name: name || null,
        evidence: channel !== "online" ? evidence : undefined,
        status: channel === "online" ? "INVITED" : "COMPLETED",
        completed_at: channel !== "online" ? new Date() : null,
      },
    });
    await createAuditLog({
      req,
      companyId: c.company_id,
      companyUserId: req.user!.sub,
      action: channel === "online" ? "CREATE" : "COMPLETE_SERVICE",
      entityType: "ServiceConversation",
      entityId: c.id,
    });
    notify(c.company_id, c.branch_id);
    res.status(201).json({ success: true, data: c });
  }),
);
router.get(
  "/conversations/:id",
  wrap(async (req, res) => {
    const c = await conversation(req);
    const messages = await prisma.serviceMessage.findMany({
      where: { conversation_id: c.id },
      orderBy: [{ created_at: "asc" }, { id: "asc" }],
      take: 1000,
    });
    res.json({ success: true, data: { ...c, messages } });
  }),
);
router.post(
  "/conversations/:id/messages",
  wrap(async (req, res) => {
    const c = await conversation(req);
    if (c.operator_id !== req.user!.sub)
      throw new ErrorHandler("Only the assigned operator can reply", 403);
    const text = String(req.body.text || "").trim();
    if (!text || text.length > 4000)
      throw new ErrorHandler("Message must contain 1–4000 characters", 400);
    await prisma.$transaction(async (tx) => {
      const locked = await tx.serviceConversation.updateMany({
        where: { id: c.id, status: "ACTIVE" },
        data: { status: "ACTIVE" },
      });
      if (!locked.count)
        throw new ErrorHandler("Customer must join before you reply", 409);
      await tx.serviceMessage.create({
        data: { conversation_id: c.id, sender: "operator", text },
      });
    });
    notify(c.company_id, c.branch_id);
    res.json({ success: true });
  }),
);
router.post(
  "/conversations/:id/complete",
  wrap(async (req, res) => {
    const c = await conversation(req);
    const done = await prisma.serviceConversation.updateMany({
      where: { id: c.id, status: "ACTIVE" },
      data: { status: "COMPLETED", completed_at: new Date() },
    });
    if (!done.count) throw new ErrorHandler("Conversation is not active", 409);
    await createAuditLog({
      req,
      companyId: c.company_id,
      companyUserId: c.operator_id,
      action: "COMPLETE_SERVICE",
      entityType: "ServiceConversation",
      entityId: c.id,
    });
    notify(c.company_id, c.branch_id);
    res.json({ success: true });
  }),
);
router.post(
  "/password",
  wrap(async (req, res) => {
    const u = await prisma.companyUser.findUnique({
      where: { id: req.user!.sub },
    });
    if (
      !u ||
      !(await verifyPassword(
        String(req.body.current_password || ""),
        u.password_hash,
      ))
    )
      throw new ErrorHandler("Current password is incorrect", 400);
    const password = String(req.body.new_password || "");
    if (password.length < 8 || password.length > 128)
      throw new ErrorHandler("Use 8–128 characters", 400);
    await prisma.companyUser.update({
      where: { id: u.id },
      data: { password_hash: hashPassword(password) },
    });
    await createAuditLog({
      req,
      companyId: u.company_id,
      companyUserId: u.id,
      action: "UPDATE",
      entityType: "Password",
      entityId: u.id,
    });
    res.json({ success: true });
  }),
);
router.get(
  "/summary",
  wrap(async (req, res) => {
    const now = new Date();
    const from = req.query.from
      ? new Date(String(req.query.from))
      : new Date(now.getFullYear(), now.getMonth(), 1);
    const to = req.query.to ? new Date(String(req.query.to)) : now;
    if (
      !Number.isFinite(from.getTime()) ||
      !Number.isFinite(to.getTime()) ||
      from > to
    )
      throw new ErrorHandler("Invalid date range", 400);
    const users = await prisma.companyUser.findMany({
      where: {
        company_id: req.user!.companyId,
        ...(!admin(req) ? { id: req.user!.sub } : {}),
      },
      select: { id: true, first_name: true, last_name: true },
    });
    const company = await prisma.company.findUnique({
      where: { id: req.user!.companyId! },
    });
    const settings = (company?.settings || {}) as any;
    const rows = await Promise.all(
      users.map(async (u) => {
        const [sessions, tickets, external] = await Promise.all([
          prisma.counterSession.findMany({
            where: {
              company_user_id: u.id,
              started_at: { lte: to },
              OR: [{ ended_at: null }, { ended_at: { gte: from } }],
            },
            include: { counter: { select: { name_uz: true } } },
          }),
          prisma.ticket.aggregate({
            where: {
              served_by_id: u.id,
              status: "COMPLETED",
              completed_at: { gte: from, lte: to },
            },
            _count: true,
            _avg: { service_time_sec: true },
          }),
          prisma.serviceConversation.count({
            where: {
              operator_id: u.id,
              company_id: req.user!.companyId,
              status: "COMPLETED",
              completed_at: { gte: from, lte: to },
            },
          }),
        ]);
        const seconds = sessions.reduce(
          (n, s) =>
            n +
            Math.max(
              0,
              (Math.min((s.ended_at || now).getTime(), to.getTime()) -
                Math.max(s.started_at.getTime(), from.getTime())) /
                1000,
            ),
          0,
        );
        const pay = settings.compensation?.[u.id] || {};
        const served = tickets._count + external;
        const alerts = [];
        if (
          sessions.some(
            (s) =>
              s.is_active &&
              now.getTime() - s.started_at.getTime() >
                Number(settings.rules?.max_shift_hours || 12) * 3600000,
          )
        )
          alerts.push("Long open shift");
        if (
          tickets._avg.service_time_sec &&
          tickets._avg.service_time_sec >
            Number(settings.rules?.max_service_minutes || 30) * 60
        )
          alerts.push("Service time above target");
        return {
          ...u,
          worked_seconds: Math.round(seconds),
          sessions: sessions.length,
          online: sessions.some((s) => s.is_active),
          served,
          external,
          avg_service_sec: tickets._avg.service_time_sec,
          salary: Number(pay.salary || 0),
          rate: Number(pay.rate || 0),
          earned_kpi: Math.round(served * Number(pay.rate || 0) * 100) / 100,
          alerts,
        };
      }),
    );
    res.json({ success: true, data: rows });
  }),
);
router.patch(
  "/compensation/:id",
  requireCompanyAdmin,
  wrap(async (req, res) => {
    const u = await prisma.companyUser.findFirst({
      where: { id: req.params.id, company_id: req.user!.companyId },
    });
    if (!u) throw new ErrorHandler("Operator not found", 404);
    const salary = Number(req.body.salary),
      rate = Number(req.body.rate);
    if (
      !Number.isFinite(salary) ||
      salary < 0 ||
      !Number.isFinite(rate) ||
      rate < 0
    )
      throw new ErrorHandler("Enter non-negative salary and KPI rate", 400);
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM companies WHERE id = ${u.company_id}::uuid FOR UPDATE`;
      const company = await tx.company.findUnique({
        where: { id: u.company_id },
      });
      const s = (company?.settings || {}) as any;
      await tx.company.update({
        where: { id: u.company_id },
        data: {
          settings: {
            ...s,
            compensation: { ...s.compensation, [u.id]: { salary, rate } },
          },
        },
      });
    });
    await createAuditLog({
      req,
      companyId: u.company_id,
      companyUserId: req.user!.sub,
      action: "UPDATE",
      entityType: "Compensation",
      entityId: u.id,
      metadata: { salary, rate },
    });
    notify(u.company_id);
    res.json({ success: true });
  }),
);
export const operationsRoutes = router;
