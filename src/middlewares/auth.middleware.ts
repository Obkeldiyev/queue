import { Request, Response, NextFunction } from "express";
import { verifyAccessToken, JwtPayload } from "@utils";
import { ErrorHandler } from "@errors";

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
    next();
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
