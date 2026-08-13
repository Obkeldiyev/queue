import { WebSocketServer, WebSocket } from "ws";
import { Server } from "http";

export type WsEventType =
  | "ticket:issued"
  | "ticket:called"
  | "ticket:completed"
  | "ticket:no_show"
  | "ticket:cancelled"
  | "ticket:transferred"
  | "order:status_changed"
  | "device:heartbeat"
  | "counter:session_opened"
  | "counter:session_closed";

export interface WsMessage {
  event: WsEventType;
  branchId?: string;
  companyId?: string;
  payload: unknown;
}

let wss: WebSocketServer | null = null;

export function initWebSocket(server: Server): WebSocketServer {
  wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws: WebSocket, req) => {
    const url = new URL(req.url ?? "/", "ws://localhost");
    const branchId = url.searchParams.get("branchId");
    const companyId = url.searchParams.get("companyId");

    // Attach context to socket
    (ws as WebSocket & { branchId?: string; companyId?: string }).branchId = branchId ?? undefined;
    (ws as WebSocket & { branchId?: string; companyId?: string }).companyId = companyId ?? undefined;

    // Send a ping every 30s to keep the connection alive through nginx/load-balancers.
    // The client does not need to handle pings — the ws library handles pong automatically.
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      } else {
        clearInterval(pingInterval);
      }
    }, 30_000);

    ws.on("close", () => clearInterval(pingInterval));
    ws.on("error", (err) => { console.error("[ws] client error", err); clearInterval(pingInterval); });
    ws.send(JSON.stringify({ event: "connected", payload: { branchId, companyId } }));
  });

  console.log("✅ WebSocket server initialized on /ws");
  return wss;
}

export function broadcast(message: WsMessage): void {
  if (!wss) return;
  const data = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client.readyState !== WebSocket.OPEN) return;
    const c = client as WebSocket & { branchId?: string; companyId?: string };
    // Send to matching branch/company subscribers, or broadcast if no filter
    const matchesBranch = !message.branchId || c.branchId === message.branchId;
    const matchesCompany = !message.companyId || c.companyId === message.companyId;
    if (matchesBranch && matchesCompany) {
      client.send(data);
    }
  });
}
