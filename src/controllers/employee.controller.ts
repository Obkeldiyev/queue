import { Response, NextFunction } from "express";
import prisma from "../prisma/client";
import { ErrorHandler } from "@errors";
import { hashPassword, createAuditLog } from "@utils";
import { ensureDefaultCompanyRoles } from "../utils/company-roles";
import type { CreateCompanyUserDto, UpdateCompanyUserDto, CreateCompanyRoleDto } from "../dto/employee.dto";
import type { AuthRequest } from "@middlewares";

const USER_SELECT = {
  id: true, first_name: true, last_name: true, email: true, phone: true,
  status: true, branch_id: true, company_id: true, default_counter_id: true, last_login_at: true, created_at: true,
  roles: { include: { company_role: { select: { id: true, name: true, type: true } } } },
  branch: { select: { id: true, name_uz: true, name_ru: true, name_en: true } },
};

export class EmployeeController {
  // GET /employees
  static async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user?.type === "company_user" ? req.user.companyId : (req.query.company_id as string | undefined);
      const branchId = req.query.branch_id as string | undefined;
      const where: Record<string, unknown> = {};
      if (companyId) where.company_id = companyId;
      if (branchId) where.branch_id = branchId;

      const users = await prisma.companyUser.findMany({
        where,
        orderBy: { created_at: "asc" },
        select: USER_SELECT,
      });
      res.json({ success: true, data: users });
    } catch (e) { next(e); }
  }

  // POST /employees
  static async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = req.body as CreateCompanyUserDto & { company_id?: string };
      const companyId = req.user?.type === "company_user" ? req.user.companyId : (body.company_id ?? undefined);
      if (!companyId) return next(new ErrorHandler("company_id required", 400));

      const exists = await prisma.companyUser.findFirst({ where: { company_id: companyId, email: body.email } });
      if (exists) return next(new ErrorHandler("Email already registered in this company", 409));

      const password_hash = hashPassword(body.password);
      const user = await prisma.companyUser.create({
        data: {
          company_id: companyId,
          branch_id: body.branch_id,
          first_name: body.first_name,
          last_name: body.last_name,
          email: body.email,
          phone: body.phone,
          password_hash,
        },
        select: { id: true, first_name: true, last_name: true, email: true, status: true, branch_id: true, company_id: true, created_at: true },
      });

      if (body.role_ids?.length) {
        await prisma.companyUserRole.createMany({
          data: body.role_ids.map((rid) => ({ company_user_id: user.id, company_role_id: rid })),
        });
      } else {
        await ensureDefaultCompanyRoles(companyId);
        // If the caller is a platform admin creating the first user for a company,
        // assign COMPANY_ADMIN. Otherwise default to OPERATOR.
        const roleType = req.user?.type === "platform_user" ? "COMPANY_ADMIN" : "OPERATOR";
        const defaultRole = await prisma.companyRole.findFirst({
          where: { company_id: companyId, type: roleType as any },
        });
        if (defaultRole) {
          await prisma.companyUserRole.create({
            data: { company_user_id: user.id, company_role_id: defaultRole.id },
          });
        }
      }

      await createAuditLog({
        req, companyId,
        companyUserId: req.user?.type === "company_user" ? req.user.sub : undefined,
        action: "CREATE", entityType: "CompanyUser", entityId: user.id,
      });

      res.status(201).json({ success: true, data: user });
    } catch (e) { next(e); }
  }

  // GET /employees/:id
  static async findOne(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const user = await prisma.companyUser.findUnique({
        where: { id: req.params.id },
        select: USER_SELECT,
      });
      if (!user) return next(new ErrorHandler("Employee not found", 404));
      res.json({ success: true, data: user });
    } catch (e) { next(e); }
  }

  // PATCH /employees/:id
  static async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = req.body as UpdateCompanyUserDto;
      const user = await prisma.companyUser.update({
        where: { id: req.params.id },
        data: {
          ...(body.branch_id !== undefined && { branch_id: body.branch_id }),
          ...(body.first_name && { first_name: body.first_name }),
          ...(body.last_name && { last_name: body.last_name }),
          ...(body.phone !== undefined && { phone: body.phone }),
          ...(body.status && { status: body.status }),
          ...(Object.prototype.hasOwnProperty.call(body, 'default_counter_id')
            ? { default_counter_id: (body as any).default_counter_id }
            : {}),
          // Allow admin to reset password
          ...((body as any).password
            ? { password_hash: hashPassword((body as any).password) }
            : {}),
        } as any,
        select: { id: true, first_name: true, last_name: true, email: true, status: true },
      });
      res.json({ success: true, data: user });
    } catch (e) { next(e); }
  }

  // DELETE /employees/:id
  static async remove(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await prisma.companyUser.delete({ where: { id: _req.params.id } });
      res.json({ success: true, message: "Employee deleted" });
    } catch (e) { next(e); }
  }

  // ---- Roles ----
  static async listRoles(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user?.type === "company_user" ? req.user.companyId : (req.query.company_id as string | undefined);
      const roles = await prisma.companyRole.findMany({
        where: companyId ? { company_id: companyId } : undefined,
        include: { permissions: { include: { company_permission: true } } },
      });
      res.json({ success: true, data: roles });
    } catch (e) { next(e); }
  }

  static async createRole(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = req.body as CreateCompanyRoleDto & { company_id?: string };
      const companyId = req.user?.type === "company_user" ? req.user.companyId : (body.company_id ?? undefined);
      if (!companyId) return next(new ErrorHandler("company_id required", 400));

      const role = await prisma.companyRole.create({
        data: { company_id: companyId, name: body.name, description: body.description },
      });

      if (body.permission_codes?.length) {
        const perms = await prisma.companyPermission.findMany({ where: { code: { in: body.permission_codes } } });
        await prisma.companyRolePermission.createMany({
          data: perms.map((p: { id: string }) => ({ company_role_id: role.id, company_permission_id: p.id })),
        });
      }

      res.status(201).json({ success: true, data: role });
    } catch (e) { next(e); }
  }

  static async listPermissions(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const perms = await prisma.companyPermission.findMany({ orderBy: [{ module: "asc" }, { name: "asc" }] });
      res.json({ success: true, data: perms });
    } catch (e) { next(e); }
  }
}


