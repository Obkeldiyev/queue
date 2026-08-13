import { Request, Response, NextFunction } from "express";
import prisma from "../prisma/client";
import {
  hashPassword,
  verifyPassword,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  refreshTokenExpiresAt,
} from "@utils";
import { ErrorHandler } from "@errors";
import crypto from "crypto";
import type { PlatformLoginDto, CompanyLoginDto, RefreshTokenDto, CreatePlatformUserDto } from "../dto/auth.dto";

function tokenHash(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export class AuthController {
  // POST /auth/platform/register — only allowed when NO platform admin exists yet
  static async registerPlatformUser(req: Request, res: Response, next: NextFunction) {
    try {
      // Block if any platform user already exists
      const count = await prisma.platformUser.count();
      if (count > 0) {
        return next(new ErrorHandler("Platform already has an admin. Registration is disabled.", 403));
      }

      const body = req.body as CreatePlatformUserDto;
      const existing = await prisma.platformUser.findUnique({ where: { email: body.email } });
      if (existing) return next(new ErrorHandler("Email already registered", 409));

      const password_hash = hashPassword(body.password);
      const user = await prisma.platformUser.create({
        data: {
          first_name: body.first_name,
          last_name: body.last_name,
          email: body.email,
          password_hash,
        },
      });

      res.status(201).json({
        success: true,
        data: { id: user.id, email: user.email, first_name: user.first_name, last_name: user.last_name },
      });
    } catch (e) { next(e); }
  }

  // POST /auth/platform/login
  static async platformLogin(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body as PlatformLoginDto;
      const user = await prisma.platformUser.findUnique({ where: { email } });
      if (!user || !(await verifyPassword(password, user.password_hash))) {
        return next(new ErrorHandler("Invalid credentials", 401));
      }
      if (user.status !== "ACTIVE") return next(new ErrorHandler("Account is not active", 403));

      await prisma.platformUser.update({ where: { id: user.id }, data: { last_login_at: new Date() } });

      const payload = { sub: user.id, type: "platform_user" as const, email: user.email };
      const accessToken = signAccessToken(payload);
      const refreshToken = signRefreshToken(payload);

      await prisma.refreshToken.create({
        data: {
          user_id: user.id,
          user_type: "platform_user",
          token_hash: tokenHash(refreshToken),
          ip_address: req.ip,
          user_agent: req.headers["user-agent"],
          expires_at: refreshTokenExpiresAt(),
        },
      });

      res.json({
        success: true,
        data: {
          accessToken,
          refreshToken,
          user: { id: user.id, email: user.email, first_name: user.first_name, last_name: user.last_name, type: "platform_user" },
        },
      });
    } catch (e) { next(e); }
  }

  // POST /auth/company/login
  static async companyLogin(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password, companySlug } = req.body as CompanyLoginDto;

      let companyUser;
      if (companySlug) {
        const company = await prisma.company.findUnique({ where: { slug: companySlug } });
        if (!company) return next(new ErrorHandler("Company not found", 404));
        companyUser = await prisma.companyUser.findFirst({
          where: { email, company_id: company.id },
          include: { roles: { include: { company_role: true } } },
        });
      } else {
        companyUser = await prisma.companyUser.findFirst({
          where: { email },
          include: { roles: { include: { company_role: true } } },
        });
      }

      if (!companyUser || !(await verifyPassword(password, companyUser.password_hash))) {
        return next(new ErrorHandler("Invalid credentials", 401));
      }
      if (companyUser.status !== "ACTIVE") return next(new ErrorHandler("Account is not active", 403));

      await prisma.companyUser.update({ where: { id: companyUser.id }, data: { last_login_at: new Date() } });

      const roles = companyUser.roles.map((r: { company_role: { name: string; type: string } }) => r.company_role.name);
      const roleTypes = companyUser.roles.map((r: { company_role: { name: string; type: string } }) => r.company_role.type);
      const payload = {
        sub: companyUser.id,
        type: "company_user" as const,
        email: companyUser.email,
        companyId: companyUser.company_id,
        branchId: companyUser.branch_id ?? undefined,
        roles,
        roleTypes,
      };
      const accessToken = signAccessToken(payload);
      const refreshToken = signRefreshToken(payload);

      await prisma.refreshToken.create({
        data: {
          user_id: companyUser.id,
          user_type: "company_user",
          token_hash: tokenHash(refreshToken),
          ip_address: req.ip,
          user_agent: req.headers["user-agent"],
          expires_at: refreshTokenExpiresAt(),
        },
      });

      res.json({
        success: true,
        data: {
          accessToken,
          refreshToken,
          user: {
            id: companyUser.id,
            email: companyUser.email,
            first_name: companyUser.first_name,
            last_name: companyUser.last_name,
            company_id: companyUser.company_id,
            branch_id: companyUser.branch_id,
            default_counter_id: companyUser.default_counter_id,
            roles,
            roleTypes,
            type: "company_user",
          },
        },
      });
    } catch (e) { next(e); }
  }

  // POST /auth/refresh
  static async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body as RefreshTokenDto;
      if (!refreshToken) return next(new ErrorHandler("Refresh token required", 400));

      let payload;
      try {
        payload = verifyRefreshToken(refreshToken);
      } catch {
        return next(new ErrorHandler("Invalid refresh token", 401));
      }

      const stored = await prisma.refreshToken.findFirst({
        where: { token_hash: tokenHash(refreshToken), revoked: false },
      });
      if (!stored || stored.expires_at < new Date()) {
        return next(new ErrorHandler("Refresh token expired or revoked", 401));
      }

      // Rotate: revoke old, issue new
      await prisma.refreshToken.update({ where: { id: stored.id }, data: { revoked: true } });

      const newPayload = {
        sub: payload.sub,
        type: payload.type,
        email: payload.email,
        companyId: payload.companyId,
        branchId: payload.branchId,
        roles: payload.roles,
        roleTypes: payload.roleTypes,
      };
      const newRefresh = signRefreshToken(newPayload);
      const newAccess = signAccessToken(newPayload);

      await prisma.refreshToken.create({
        data: {
          user_id: payload.sub,
          user_type: payload.type,
          token_hash: tokenHash(newRefresh),
          ip_address: req.ip,
          user_agent: req.headers["user-agent"],
          expires_at: refreshTokenExpiresAt(),
        },
      });

      res.json({ success: true, data: { accessToken: newAccess, refreshToken: newRefresh } });
    } catch (e) { next(e); }
  }

  // POST /auth/logout
  static async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body as RefreshTokenDto;
      if (refreshToken) {
        await prisma.refreshToken.updateMany({
          where: { token_hash: tokenHash(refreshToken) },
          data: { revoked: true },
        });
      }
      res.json({ success: true, message: "Logged out" });
    } catch (e) { next(e); }
  }

  // GET /auth/me
  static async me(req: Request & { user?: import("../utils/jwt").JwtPayload }, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      if (user.type === "platform_user") {
        const u = await prisma.platformUser.findUnique({ where: { id: user.sub } });
        if (!u) return next(new ErrorHandler("User not found", 404));
        return res.json({ success: true, data: { id: u.id, email: u.email, first_name: u.first_name, last_name: u.last_name, type: "platform_user" } });
      }
      if (user.type === "company_user") {
        const u = await prisma.companyUser.findUnique({
          where: { id: user.sub },
          include: { company: true, roles: { include: { company_role: true } } },
        });
        if (!u) return next(new ErrorHandler("User not found", 404));
        return res.json({
          success: true,
          data: {
            id: u.id, email: u.email, first_name: u.first_name, last_name: u.last_name,
            company_id: u.company_id, branch_id: u.branch_id,
            default_counter_id: u.default_counter_id,
            roles: u.roles.map((r: { company_role: { name: string; type: string } }) => r.company_role.name),
            roleTypes: u.roles.map((r: { company_role: { name: string; type: string } }) => r.company_role.type),
            type: "company_user",
            company: u.company ? { id: u.company.id, name: u.company.name, slug: u.company.slug } : undefined,
          },
        });
      }
      next(new ErrorHandler("Unknown user type", 400));
    } catch (e) { next(e); }
  }
}


