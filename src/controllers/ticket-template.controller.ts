import { Response, NextFunction } from "express";
import prisma from "../prisma/client";
import { ErrorHandler } from "@errors";
import type { CreateTicketTemplateDto, UpdateTicketTemplateDto } from "../dto/ticket-template.dto";
import type { AuthRequest } from "@middlewares";

export class TicketTemplateController {
  // GET /ticket-templates
  static async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user?.type === "company_user" ? req.user.companyId : (req.query.company_id as string | undefined);
      const templates = await prisma.ticketTemplate.findMany({
        where: companyId ? { company_id: companyId } : undefined,
        orderBy: { created_at: "desc" },
      });
      res.json({ success: true, data: templates });
    } catch (e) { next(e); }
  }

  // POST /ticket-templates
  static async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = req.body as CreateTicketTemplateDto & { company_id?: string };
      const companyId = req.user?.type === "company_user" ? req.user.companyId : (body.company_id ?? undefined);
      if (!companyId) return next(new ErrorHandler("company_id required", 400));

      // If setting as default, unset others
      if (body.is_default) {
        await prisma.ticketTemplate.updateMany({
          where: { company_id: companyId, is_default: true },
          data: { is_default: false },
        });
      }

      const template = await prisma.ticketTemplate.create({
        data: {
          company_id: companyId,
          name: body.name,
          layout: body.layout as any,
          width_mm: body.width_mm ?? 80,
          height_mm: body.height_mm ?? 150,
          footer_text: body.footer_text,
          show_qr: body.show_qr ?? true,
          show_barcode: body.show_barcode ?? false,
          is_default: body.is_default ?? false,
        },
      });
      res.status(201).json({ success: true, data: template });
    } catch (e) { next(e); }
  }

  // GET /ticket-templates/:id
  static async findOne(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const template = await prisma.ticketTemplate.findUnique({ where: { id: req.params.id } });
      if (!template) return next(new ErrorHandler("Template not found", 404));
      res.json({ success: true, data: template });
    } catch (e) { next(e); }
  }

  // PATCH /ticket-templates/:id
  static async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = req.body as UpdateTicketTemplateDto;
      const existing = await prisma.ticketTemplate.findUnique({ where: { id: req.params.id } });
      if (!existing) return next(new ErrorHandler("Template not found", 404));

      if (body.is_default && !existing.is_default) {
        await prisma.ticketTemplate.updateMany({
          where: { company_id: existing.company_id, is_default: true },
          data: { is_default: false },
        });
      }

      const template = await prisma.ticketTemplate.update({
        where: { id: req.params.id },
        data: {
          name: body.name,
          layout: body.layout ? (body.layout as unknown as object) : undefined,
          width_mm: body.width_mm,
          height_mm: body.height_mm,
          footer_text: body.footer_text,
          show_qr: body.show_qr,
          show_barcode: body.show_barcode,
          is_default: body.is_default,
        },
      });
      res.json({ success: true, data: template });
    } catch (e) { next(e); }
  }

  // DELETE /ticket-templates/:id
  static async remove(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await prisma.ticketTemplate.delete({ where: { id: _req.params.id } });
      res.json({ success: true, message: "Template deleted" });
    } catch (e) { next(e); }
  }
}







