import { Response, NextFunction } from "express";
import prisma from "../prisma/client";
import { ErrorHandler } from "@errors";
import type { CreateMenuDto, UpdateMenuDto, ReorderMenuDto } from "../dto/menu.dto";
import type { AuthRequest } from "@middlewares";

export class MenuController {
  // GET /menus
  static async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user?.type === "company_user" ? req.user.companyId : (req.query.company_id as string | undefined);
      const menus = await prisma.menu.findMany({
        where: companyId ? { company_id: companyId, parent_id: null } : { parent_id: null },
        orderBy: { sort_order: "asc" },
        include: {
          queue_group: { select: { id: true, name_uz: true, name_ru: true, name_en: true, prefix: true } },
          children: {
            orderBy: { sort_order: "asc" },
            include: {
              queue_group: { select: { id: true, name_uz: true, name_ru: true, name_en: true, prefix: true } },
              children: {
                orderBy: { sort_order: "asc" },
                include: {
                  queue_group: { select: { id: true, name_uz: true, name_ru: true, name_en: true, prefix: true } },
                },
              },
            },
          },
        },
      });
      res.json({ success: true, data: menus });
    } catch (e) { next(e); }
  }

  // POST /menus
  static async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = req.body as CreateMenuDto & { company_id?: string };
      const companyId = req.user?.type === "company_user" ? req.user.companyId : (body.company_id ?? undefined);
      if (!companyId) return next(new ErrorHandler("company_id required", 400));

      const menu = await prisma.menu.create({
        data: {
          company_id: companyId,
          parent_id: body.parent_id ?? null,
          name: body.name,
          label: body.label ?? body.name,
          icon_class: body.icon_class ?? null,
          url: body.url ?? null,
          page_id: body.page_id ?? null,
          queue_group_id: body.queue_group_id ?? null,
          target: body.target ?? "_self",
          sort_order: body.sort_order ?? 0,
          is_visible: body.is_visible ?? true,
          requires_auth: body.requires_auth ?? false,
        },
        include: {
          queue_group: { select: { id: true, name_uz: true, name_ru: true, name_en: true, prefix: true } },
        },
      });
      res.status(201).json({ success: true, data: menu });
    } catch (e) { next(e); }
  }

  // PATCH /menus/:id
  static async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = req.body as UpdateMenuDto;
      const menu = await prisma.menu.update({
        where: { id: req.params.id },
        data: {
          ...(body.parent_id !== undefined && { parent_id: body.parent_id }),
          ...(body.name !== undefined && { name: body.name }),
          ...(body.label !== undefined && { label: body.label }),
          ...(body.icon_class !== undefined && { icon_class: body.icon_class }),
          ...(body.url !== undefined && { url: body.url }),
          ...(body.page_id !== undefined && { page_id: body.page_id }),
          ...(body.queue_group_id !== undefined && { queue_group_id: body.queue_group_id }),
          ...(body.target !== undefined && { target: body.target }),
          ...(body.sort_order !== undefined && { sort_order: body.sort_order }),
          ...(body.is_visible !== undefined && { is_visible: body.is_visible }),
          ...(body.requires_auth !== undefined && { requires_auth: body.requires_auth }),
        },
        include: {
          queue_group: { select: { id: true, name_uz: true, name_ru: true, name_en: true, prefix: true } },
        },
      });
      res.json({ success: true, data: menu });
    } catch (e) { next(e); }
  }

  // DELETE /menus/:id
  static async remove(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await prisma.menu.delete({ where: { id: _req.params.id } });
      res.json({ success: true, message: "Menu item deleted" });
    } catch (e) { next(e); }
  }

  // PATCH /menus/reorder
  static async reorder(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = req.body as ReorderMenuDto;
      await Promise.all(
        body.items.map((item) =>
          prisma.menu.update({ where: { id: item.id }, data: { sort_order: item.sort_order } })
        )
      );
      res.json({ success: true, message: "Menu reordered" });
    } catch (e) { next(e); }
  }
}




