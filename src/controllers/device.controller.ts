import { Response, NextFunction } from "express";
import prisma from "../prisma/client";
import { ErrorHandler } from "@errors";
import { createAuditLog } from "@utils";
import crypto from "crypto";
import type { CreateDeviceDto, UpdateDeviceDto, DeviceHeartbeatDto } from "../dto/device.dto";
import type { AuthRequest } from "@middlewares";

export class DeviceController {
  // GET /devices
  static async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user?.type === "company_user" ? req.user.companyId : (req.query.company_id as string | undefined);
      const branchId = req.query.branch_id as string | undefined;
      const deviceType = req.query.device_type as string | undefined;
      const where: Record<string, unknown> = {};
      if (companyId) where.company_id = companyId;
      if (branchId) where.branch_id = branchId;
      if (deviceType) where.device_type = deviceType;

      const devices = await prisma.device.findMany({
        where,
        orderBy: { created_at: "asc" },
        include: { branch: { select: { id: true, name_uz: true } }, counter: { select: { id: true, name_uz: true } } },
      });
      res.json({ success: true, data: devices });
    } catch (e) { next(e); }
  }

  // POST /devices
  static async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = req.body as CreateDeviceDto & { company_id?: string };
      const companyId = req.user?.type === "company_user" ? req.user.companyId : (body.company_id ?? undefined);
      if (!companyId) return next(new ErrorHandler("company_id required", 400));

      const authToken = crypto.randomBytes(32).toString("hex");
      const device = await prisma.device.create({
        data: {
          company_id: companyId,
          branch_id: body.branch_id,
          counter_id: body.counter_id,
          device_type: body.device_type as any,
          name: body.name,
          serial_number: body.serial_number,
          ip_address: body.ip_address,
          mac_address: body.mac_address,
          firmware_version: body.firmware_version,
          settings: (body.settings as any) ?? undefined,
          status: "UNREGISTERED",
          auth_token: authToken,
        },
      });

      await createAuditLog({
        req, companyId,
        companyUserId: req.user?.type === "company_user" ? req.user.sub : undefined,
        action: "DEVICE_CONNECT", entityType: "Device", entityId: device.id,
      });

      // Return auth_token only on creation
      res.status(201).json({ success: true, data: { ...device, auth_token: authToken } });
    } catch (e) { next(e); }
  }

  // GET /devices/:id
  static async findOne(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const device = await prisma.device.findUnique({
        where: { id: req.params.id },
        include: {
          branch: true, counter: true,
          health_logs: { orderBy: { created_at: "desc" }, take: 10 },
        },
      });
      if (!device) return next(new ErrorHandler("Device not found", 404));
      // Strip auth_token from response
      const { auth_token: _, ...safeDevice } = device;
      res.json({ success: true, data: safeDevice });
    } catch (e) { next(e); }
  }

  // PATCH /devices/:id
  static async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = req.body as UpdateDeviceDto;
      const device = await prisma.device.update({
        where: { id: req.params.id },
        data: {
          name: body.name,
          counter_id: body.counter_id,
          ip_address: body.ip_address,
          mac_address: body.mac_address,
          firmware_version: body.firmware_version,
          settings: (body.settings as any) ?? undefined,
          ...(body.status && { status: body.status }),
        } as any,
      });
      const { auth_token: _, ...safeDevice } = device;
      res.json({ success: true, data: safeDevice });
    } catch (e) { next(e); }
  }

  // DELETE /devices/:id
  static async remove(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await prisma.device.delete({ where: { id: req.params.id } });
      await createAuditLog({
        req,
        companyUserId: req.user?.type === "company_user" ? req.user.sub : undefined,
        action: "DEVICE_DISCONNECT", entityType: "Device", entityId: req.params.id,
      });
      res.json({ success: true, message: "Device deleted" });
    } catch (e) { next(e); }
  }

  // POST /devices/:id/heartbeat — device calls this to report health
  static async heartbeat(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = req.body as DeviceHeartbeatDto;
      const token =
        req.headers["x-device-token"] ||
        (typeof req.headers.authorization === "string" && req.headers.authorization.startsWith("Bearer ")
          ? req.headers.authorization.slice(7)
          : undefined) ||
        (body as DeviceHeartbeatDto & { auth_token?: string }).auth_token;

      const existing = await prisma.device.findUnique({ where: { id: req.params.id } });
      if (!existing) return next(new ErrorHandler("Device not found", 404));
      if (!existing.auth_token || token !== existing.auth_token) {
        return next(new ErrorHandler("Invalid device token", 401));
      }

      const device = await prisma.device.update({
        where: { id: req.params.id },
        data: {
          status: (body.status ?? "ONLINE") as any,
          last_heartbeat: new Date(),
        },
      });

      await prisma.deviceHealthLog.create({
        data: {
          device_id: device.id,
          cpu_usage: body.cpu_usage,
          memory_usage: body.memory_usage,
          disk_usage: body.disk_usage,
          temperature: body.temperature,
          uptime_seconds: body.uptime_seconds,
          network_latency_ms: body.network_latency_ms,
        },
      });

      const { auth_token: _, ...safeDevice } = device;
      res.json({ success: true, data: safeDevice });
    } catch (e) { next(e); }
  }
}






