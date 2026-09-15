import { Request, Response, NextFunction } from "express";
import { verifyAccessToken, JwtPayload } from "@utils";
import { ErrorHandler } from "@errors";
import prisma from "../prisma/client";

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export function authenticate(req: AuthRequest, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return next(new ErrorHandler("No token provided", 401));
  }
  const token = authHeader.slice(7);
  try {
    req.user = verifyAccessToken(token);
    void enforceScope(req).then(() => next()).catch(next);
  } catch {
    next(new ErrorHandler("Invalid or expired token", 401));
  }
}

export function requirePlatformAdmin(req: AuthRequest, _res: Response, next: NextFunction): void {
  if (req.user?.type !== "platform_user") {
    return next(new ErrorHandler("Platform admin access required", 403));
  }
  next();
}

export function requireCompanyUser(req: AuthRequest, _res: Response, next: NextFunction): void {
  if (req.user?.type !== "company_user") {
    return next(new ErrorHandler("Company user access required", 403));
  }
  next();
}

async function enforceScope(req: AuthRequest) {
  if (req.user?.type !== "company_user") return;
  const id = req.params.id;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return;
  const resource = req.originalUrl.split("/")[3];
  const models: Record<string, string> = { devices: "device", menus: "menu", pages: "page", services: "service", counters: "counter", branches: "branch", employees: "companyUser", "ticket-templates": "ticketTemplate", queues: "queueGroup" };
  if (resource === "queues" && req.originalUrl.includes("/tickets/")) {
    const ticket = await prisma.ticket.findUnique({where:{id},include:{queue_group:true}});
    if (!ticket || ticket.queue_group.company_id !== req.user.companyId) throw new ErrorHandler("Ticket not found",404);
    const admin = req.user.roleTypes?.some(r=>["COMPANY_ADMIN","BRANCH_MANAGER","SUPERVISOR"].includes(r));
    if (!admin && ticket.served_by_id !== req.user.sub && req.method !== "GET") throw new ErrorHandler("This ticket belongs to another operator",403);
  } else if (models[resource]) {
    const entity = await (prisma as any)[models[resource]].findUnique({where:{id},select:{company_id:true}});
    if (!entity || entity.company_id !== req.user.companyId) throw new ErrorHandler("Resource not found",404);
  }
}

export function requireCompanyAdmin(req: AuthRequest, _res: Response, next: NextFunction): void {
  if (req.user?.type === "platform_user") {
    return next();
  }

  if (req.user?.type !== "company_user") {
    return next(new ErrorHandler("Company admin access required", 403));
  }

  const roleTypes = req.user.roleTypes ?? [];
  const allowed = ["COMPANY_ADMIN", "BRANCH_MANAGER", "SUPERVISOR"];
  if (!roleTypes.some((roleType) => allowed.includes(roleType))) {
    return next(new ErrorHandler("Company admin access required", 403));
  }

  next();
}

export function requireAnyAuth(req: AuthRequest, _res: Response, next: NextFunction): void {
  if (!req.user) {
    return next(new ErrorHandler("Authentication required", 401));
  }
  next();
}
