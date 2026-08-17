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

      // Fetch multilingual name columns via raw SQL and merge into results
      const allIds = menus.flatMap((m: any) => [
        m.id,
        ...(m.children ?? []).flatMap((c: any) => [c.id, ...(c.children ?? []).map((cc: any) => cc.id)]),
      ]);
      let nameMap: Record<string, { name_uz: string | null; name_ru: string | null; name_en: string | null }> = {};
      if (allIds.length > 0) {
        const rows = await prisma.$queryRawUnsafe<Array<{ id: string; name_uz: string | null; name_ru: string | null; name_en: string | null }>>(
          `SELECT id, name_uz, name_ru, name_en FROM menus WHERE id = ANY($1::uuid[])`,
          allIds
        );
        for (const r of rows) nameMap[r.id] = { name_uz: r.name_uz, name_ru: r.name_ru, name_en: r.name_en };
      }
      const merge = (item: any): any => ({
        ...item,
        ...nameMap[item.id],
        children: (item.children ?? []).map(merge),
      });

      res.json({ success: true, data: menus.map(merge) });
    } catch (e) { next(e); }
  }

  // POST /menus
  static async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = req.body as CreateMenuDto & { company_id?: string };
      const companyId = req.user?.type === "company_user" ? req.user.companyId : (body.company_id ?? undefined);
      if (!companyId) return next(new ErrorHandler("company_id required", 400));

      const nameUz = (body as any).name_uz as string | undefined;
      const nameRu = (body as any).name_ru as string | undefined;
      const nameEn = (body as any).name_en as string | undefined;

      const menu = await prisma.menu.create({
        data: {
          company_id: companyId,
          parent_id: body.parent_id ?? null,
          name: nameUz ?? body.name,
          label: body.label ?? nameUz ?? body.name,
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

      // Patch multilingual columns via raw SQL (Prisma client not yet regenerated for new columns)
      if (nameUz || nameRu || nameEn) {
        const sets: string[] = [];
        const values: unknown[] = [];
        if (nameUz) { sets.push(`name_uz = $${sets.length + 1}`); values.push(nameUz); }
        if (nameRu) { sets.push(`name_ru = $${sets.length + 1}`); values.push(nameRu); }
        if (nameEn) { sets.push(`name_en = $${sets.length + 1}`); values.push(nameEn); }
        values.push(menu.id);
        await prisma.$executeRawUnsafe(
          `UPDATE menus SET ${sets.join(", ")} WHERE id = $${values.length}::uuid`,
          ...values
        );
      }

      res.status(201).json({ success: true, data: { ...menu, name_uz: nameUz ?? null, name_ru: nameRu ?? null, name_en: nameEn ?? null } });
    } catch (e) { next(e); }
  }

  // PATCH /menus/:id
  static async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = req.body as UpdateMenuDto;
      const nameUz = (body as any).name_uz as string | undefined;
      const nameRu = (body as any).name_ru as string | undefined;
      const nameEn = (body as any).name_en as string | undefined;

      // Update known Prisma fields
      await prisma.menu.update({
        where: { id: req.params.id },
        data: {
          ...(nameUz !== undefined ? { name: nameUz } : body.name !== undefined ? { name: body.name } : {}),
          ...(body.label !== undefined && { label: body.label }),
          ...(body.parent_id !== undefined && { parent_id: body.parent_id }),
          ...(body.icon_class !== undefined && { icon_class: body.icon_class }),
          ...(body.url !== undefined && { url: body.url }),
          ...(body.page_id !== undefined && { page_id: body.page_id }),
          ...(body.queue_group_id !== undefined && { queue_group_id: body.queue_group_id }),
          ...(body.target !== undefined && { target: body.target }),
          ...(body.sort_order !== undefined && { sort_order: body.sort_order }),
          ...(body.is_visible !== undefined && { is_visible: body.is_visible }),
          ...(body.requires_auth !== undefined && { requires_auth: body.requires_auth }),
        },
      });

      // Patch multilingual columns via raw SQL
      const sets: string[] = [];
      const values: unknown[] = [];
      if (nameUz !== undefined) { sets.push(`name_uz = $${sets.length + 1}`); values.push(nameUz); }
      if (nameRu !== undefined) { sets.push(`name_ru = $${sets.length + 1}`); values.push(nameRu); }
      if (nameEn !== undefined) { sets.push(`name_en = $${sets.length + 1}`); values.push(nameEn); }
      if (sets.length > 0) {
        values.push(req.params.id);
        await prisma.$executeRawUnsafe(
          `UPDATE menus SET ${sets.join(", ")} WHERE id = $${values.length}::uuid`,
          ...values
        );
      }

      // Return the final record with multilingual fields merged
      const menu = await prisma.menu.findUnique({
        where: { id: req.params.id },
        include: {
          queue_group: { select: { id: true, name_uz: true, name_ru: true, name_en: true, prefix: true } },
        },
      });

      // Fetch updated multilingual fields
      const [raw] = await prisma.$queryRawUnsafe<Array<{ name_uz: string | null; name_ru: string | null; name_en: string | null }>>(
        `SELECT name_uz, name_ru, name_en FROM menus WHERE id = $1::uuid`,
        req.params.id
      );

      res.json({ success: true, data: { ...menu, ...raw } });
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
