import prisma from "../prisma/client";
import { Request } from "express";

export type AuditActionType =
  | "CREATE" | "UPDATE" | "DELETE" | "LOGIN" | "LOGOUT"
  | "CALL_NEXT" | "COMPLETE_SERVICE" | "TRANSFER" | "PRINT_TICKET"
  | "SCAN_QR" | "DEVICE_CONNECT" | "DEVICE_DISCONNECT" | "PAYMENT"
  | "REFUND" | "PUBLISH_PAGE" | "TOGGLE_STATUS";

interface AuditParams {
  req?: Request;
  companyId?: string;
  platformUserId?: string;
  companyUserId?: string;
  actorType?: string;
  action: AuditActionType;
  entityType?: string;
  entityId?: string;
  branchId?: string;
  beforeState?: object;
  afterState?: object;
  metadata?: object;
}

export async function createAuditLog(params: AuditParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        company_id: params.companyId,
        platform_user_id: params.platformUserId,
        company_user_id: params.companyUserId,
        actor_type: params.actorType ?? (params.platformUserId ? "platform_user" : params.companyUserId ? "company_user" : "system"),
        action: params.action as any,
        entity_type: params.entityType,
        entity_id: params.entityId,
        branch_id: params.branchId,
        ip_address: params.req ? (params.req.ip ?? undefined) : undefined,
        user_agent: params.req?.headers["user-agent"],
        before_state: params.beforeState ?? undefined,
        after_state: params.afterState ?? undefined,
        metadata: params.metadata ?? undefined,
      },
    });
  } catch {
    // Audit log failure must never crash the main flow
  }
}
