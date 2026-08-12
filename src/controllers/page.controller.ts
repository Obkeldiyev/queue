import { Response, NextFunction } from "express";
import prisma from "../prisma/client";
import { ErrorHandler } from "@errors";
import type { CreatePageDto, UpdatePageDto, AddPageComponentDto, UpdatePageComponentDto } from "../dto/page.dto";
import type { AuthRequest } from "@middlewares";

export class PageController {
  // GET /pages
  static async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user?.type === "company_user" ? req.user.companyId : (req.query.company_id as string | undefined);
      const pages = await prisma.page.findMany({
        where: companyId ? { company_id: companyId } : undefined,
        orderBy: { created_at: "desc" },
        include: { _count: { select: { versions: true } } },
      });
      res.json({ success: true, data: pages });
    } catch (e) { next(e); }
  }

  // POST /pages
  static async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = req.body as CreatePageDto & { company_id?: string };
      const companyId = req.user?.type === "company_user" ? req.user.companyId : (body.company_id ?? undefined);
      if (!companyId) return next(new ErrorHandler("company_id required", 400));

      const slugExists = await prisma.page.findFirst({ where: { company_id: companyId, slug: body.slug } });
      if (slugExists) return next(new ErrorHandler("Slug already exists", 409));

      const page = await prisma.page.create({
        data: {
          company_id: companyId,
          name: body.name,
          slug: body.slug,
          title: body.title,
          description: body.description,
          seo_title: body.seo_title,
          seo_description: body.seo_description,
          template: body.template,
          is_homepage: body.is_homepage ?? false,
          status: "DRAFT",
        },
      });

      // Auto-create initial version
      await prisma.pageVersion.create({
        data: {
          page_id: page.id,
          version: 1,
          created_by: req.user?.type === "company_user" ? req.user.sub : undefined,
        },
      });

      res.status(201).json({ success: true, data: page });
    } catch (e) { next(e); }
  }

  // GET /pages/:id  (with latest version and components)
  static async findOne(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const page = await prisma.page.findUnique({
        where: { id: req.params.id },
        include: {
          versions: {
            orderBy: { version: "desc" },
            take: 1,
            include: {
              components: { orderBy: { sort_order: "asc" } },
            },
          },
        },
      });
      if (!page) return next(new ErrorHandler("Page not found", 404));
      res.json({ success: true, data: page });
    } catch (e) { next(e); }
  }

  // PATCH /pages/:id
  static async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = req.body as UpdatePageDto;
      const page = await prisma.page.update({
        where: { id: req.params.id },
        data: {
          name: body.name, slug: body.slug, title: body.title,
          description: body.description, seo_title: body.seo_title,
          seo_description: body.seo_description, template: body.template,
          is_homepage: body.is_homepage,
          ...(body.status && { status: body.status }),
        } as any,
      });
      res.json({ success: true, data: page });
    } catch (e) { next(e); }
  }

  // DELETE /pages/:id
  static async remove(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await prisma.page.delete({ where: { id: _req.params.id } });
      res.json({ success: true, message: "Page deleted" });
    } catch (e) { next(e); }
  }

  // POST /pages/:id/components
  static async addComponent(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = req.body as AddPageComponentDto;
      const latestVersion = await prisma.pageVersion.findFirst({
        where: { page_id: req.params.id },
        orderBy: { version: "desc" },
      });
      if (!latestVersion) return next(new ErrorHandler("Page version not found", 404));

      const component = await prisma.pageComponent.create({
        data: {
          page_version_id: latestVersion.id,
          component_type: body.component_type as any,
          parent_component_id: body.parent_component_id,
          x_position: body.x_position ?? 0,
          y_position: body.y_position ?? 0,
          width: body.width ?? 100,
          height: body.height,
          sort_order: body.sort_order ?? 0,
          col_span: body.col_span ?? 12,
          row_span: body.row_span ?? 1,
          settings: (body.settings as any) ?? undefined,
          styles: (body.styles as any) ?? undefined,
          mobile_styles: (body.mobile_styles as any) ?? undefined,
          animations: (body.animations as any) ?? undefined,
        },
      });
      res.status(201).json({ success: true, data: component });
    } catch (e) { next(e); }
  }

  // PATCH /pages/:id/components/:componentId
  static async updateComponent(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = req.body as UpdatePageComponentDto;
      const component = await prisma.pageComponent.update({
        where: { id: req.params.componentId },
        data: {
          x_position: body.x_position,
          y_position: body.y_position,
          width: body.width,
          height: body.height,
          sort_order: body.sort_order,
          col_span: body.col_span,
          row_span: body.row_span,
          settings: (body.settings as any) ?? undefined,
          styles: (body.styles as any) ?? undefined,
          mobile_styles: (body.mobile_styles as any) ?? undefined,
          animations: (body.animations as any) ?? undefined,
          is_locked: body.is_locked,
          is_hidden: body.is_hidden,
        },
      });
      res.json({ success: true, data: component });
    } catch (e) { next(e); }
  }

  // DELETE /pages/:id/components/:componentId
  static async removeComponent(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await prisma.pageComponent.delete({ where: { id: _req.params.componentId } });
      res.json({ success: true, message: "Component removed" });
    } catch (e) { next(e); }
  }

  // POST /pages/:id/publish
  static async publish(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      // Create a new version and mark published
      const latestVersion = await prisma.pageVersion.findFirst({
        where: { page_id: req.params.id },
        orderBy: { version: "desc" },
        include: { components: true },
      });
      if (!latestVersion) return next(new ErrorHandler("No version found", 404));

      await prisma.pageVersion.update({ where: { id: latestVersion.id }, data: { published: true } });
      await prisma.page.update({ where: { id: req.params.id }, data: { status: "PUBLISHED" } });

      res.json({ success: true, message: "Page published" });
    } catch (e) { next(e); }
  }
}







