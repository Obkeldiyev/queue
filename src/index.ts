import express, { Application } from "express";
import http from "http";
import dotenv from "dotenv";
import router from "./routes";
import { ErrorHandlerMiddleware } from "@middlewares";
import { initWebSocket } from "./utils/websocket";
import path from "path";
import cors from "cors";
import type { CorsOptions } from "cors";

dotenv.config();

const app: Application = express();

const corsOrigin = process.env.CORS_ORIGIN || "*";
const corsOptions: CorsOptions =
  corsOrigin === "*"
    ? { origin: "*", methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"], allowedHeaders: ["Content-Type", "Authorization", "x-device-token"] }
    : {
        origin: corsOrigin.split(",").map((s) => s.trim()),
        methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "x-device-token"],
        credentials: true,
      };

app.use(cors(corsOptions));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.use(router);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

app.use(ErrorHandlerMiddleware.errorHandlerMiddleware);

const PORT = parseInt(process.env.APP_PORT || "9000", 10);
const server = http.createServer(app);

// WebSocket for real-time queue updates
initWebSocket(server);

server.listen(PORT, () => {
  console.log(`✅ QMS API running on port ${PORT}`);
  console.log(`📍 REST: http://localhost:${PORT}/api/v1/health`);
  console.log(`🔌 WebSocket: ws://localhost:${PORT}/ws`);
});
