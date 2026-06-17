import express from "express";
import pino from "pino";
import { SessionManager } from "./session-manager.js";
import { WebhookForwarder } from "./webhook.js";
import { createRouter } from "./routes.js";

const PORT = parseInt(process.env.PORT || "3080", 10);
const API_KEY = process.env.API_KEY || "";
const LOG_LEVEL = process.env.LOG_LEVEL || "info";
const AUTH_STATE_DIR = process.env.AUTH_STATE_DIR || "./auth_data";

const logger = pino({
  level: LOG_LEVEL,
  transport:
    process.env.NODE_ENV !== "production"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
});

// --- Webhook forwarder ---
const webhook = new WebhookForwarder(
  logger.child({ module: "webhook" }),
  process.env.WEBHOOK_TOKEN || ""
);

// --- Session manager (multi-session) ---
const manager = new SessionManager(
  logger.child({ module: "whatsapp-web.js" }),
  AUTH_STATE_DIR,
  (payload) => webhook.forward(payload)
);

// --- Express app ---
const app = express();
app.use(express.json());

// API key auth middleware (skip for /health)
app.use((req, res, next) => {
  if (req.path === "/health") return next();
  if (!API_KEY) return next(); // no key configured = open access

  const provided = req.headers["x-api-key"];
  if (provided !== API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
});

app.use(createRouter(manager, webhook, logger));

// 404 fallback
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Global error handler
app.use((err, req, res, _next) => {
  logger.error({ err, path: req.path }, "Unhandled error");
  res.status(500).json({ error: "Internal server error" });
});

// --- Start server ---
const server = app.listen(PORT, () => {
  logger.info({ port: PORT }, "WhatsApp Bridge v2.0 (whatsapp-web.js) is running");
});

// --- Graceful shutdown ---
async function shutdown(signal) {
  logger.info({ signal }, "Shutdown signal received");

  server.close(() => {
    logger.info("HTTP server closed");
  });

  await manager.shutdownAll();
  logger.info("All sessions closed");
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
