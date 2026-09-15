import prisma from "../prisma/client";
import { broadcast } from "./websocket";
// Determine the latest local midnight without relying on the server's timezone.
export function dayBoundary(now: Date, timezone: string): Date {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(now).map((p) => [p.type, p.value]),
  );
  let candidate = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
  );
  for (let i = 0; i < 3; i++) {
    const p = Object.fromEntries(
      formatter
        .formatToParts(new Date(candidate))
        .map((p) => [p.type, p.value]),
    );
    const local = Date.UTC(
      Number(p.year),
      Number(p.month) - 1,
      Number(p.day),
      Number(p.hour),
      Number(p.minute),
      Number(p.second),
    );
    const desired = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
    );
    candidate += desired - local;
  }
  return new Date(candidate);
}
export async function resetBranch(
  companyId: string,
  branchId: string,
  before?: Date,
) {
  const count = await prisma.$transaction(async (tx) => {
    const tickets = await tx.ticket.findMany({
      where: {
        branch_id: branchId,
        queue_group: { company_id: companyId },
        status: { in: ["WAITING", "CALLED", "SERVING"] },
        ...(before ? { created_at: { lt: before } } : {}),
      },
      select: { id: true, status: true },
    });
    let count = 0;
    for (const t of tickets) {
      const changed = await tx.ticket.updateMany({
        where: { id: t.id, status: t.status },
        data: { status: "CANCELLED", completed_at: new Date() },
      });
      if (changed.count) {
        count++;
        await tx.ticketHistory.create({
          data: {
            ticket_id: t.id,
            from_status: t.status,
            to_status: "CANCELLED",
            changed_type: "system",
            note: before ? "End of business day" : "Administrator queue reset",
          },
        });
      }
    }
    return count;
  });
  if (count) {
    await prisma.auditLog.create({
      data: {
        company_id: companyId,
        branch_id: branchId,
        actor_type: "system",
        action: "UPDATE",
        entity_type: "QueueReset",
        metadata: { count, automatic: !!before },
      },
    });
    broadcast({
      event: "queue:reset",
      companyId,
      branchId,
      payload: { count },
    });
  }
  return count;
}
export function startDailyReset() {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const branches = await prisma.branch.findMany({
        select: {
          id: true,
          company_id: true,
          company: { select: { timezone: true } },
        },
      });
      for (const b of branches) {
        try {
          await resetBranch(
            b.company_id,
            b.id,
            dayBoundary(new Date(), b.company.timezone || "Asia/Tashkent"),
          );
        } catch (e) {
          console.error(
            "[daily reset]",
            b.id,
            e instanceof Error ? e.message : e,
          );
        }
      }
    } finally {
      running = false;
    }
  };
  const timer = setInterval(() => void tick().catch(console.error), 60000);
  timer.unref();
  void tick().catch(console.error);
}
