import { Router } from "express";
import QRCode from "qrcode";

const DEFAULT_SESSION = "default";

export function createRouter(manager, webhook, logger) {
  const router = Router();

  // Resolve the session name from (in order): route param `:name`,
  // body.session, query.session — falling back to "default" for back-compat.
  function resolveName(req) {
    return (
      req.params?.name ||
      req.body?.session ||
      req.query?.session ||
      DEFAULT_SESSION
    );
  }

  // POST /api/sendText
  router.post("/api/sendText", async (req, res) => {
    const { chatId, text } = req.body;
    const name = resolveName(req);

    if (!chatId || !text) {
      return res.status(400).json({ error: "chatId and text are required" });
    }

    const session = manager.get(name);
    if (!session || session.getStatus() !== "WORKING") {
      return res
        .status(503)
        .json({ error: "Session not connected", status: manager.status(name) });
    }

    try {
      const result = await session.sendText(chatId, text);
      res.json(result);
    } catch (err) {
      logger.error({ err, chatId, name }, "sendText failed");
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/sendImage
  router.post("/api/sendImage", async (req, res) => {
    const { chatId, url, caption, viewOnce } = req.body;
    const name = resolveName(req);

    if (!chatId || !url) {
      return res.status(400).json({ error: "chatId and url are required" });
    }

    const session = manager.get(name);
    if (!session || session.getStatus() !== "WORKING") {
      return res
        .status(503)
        .json({ error: "Session not connected", status: manager.status(name) });
    }

    try {
      const result = await session.sendImage(chatId, url, caption || "", viewOnce !== false);
      res.json(result);
    } catch (err) {
      logger.error({ err, chatId, url, name }, "sendImage failed");
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/sendTyping - simular "escribiendo..."
  router.post("/api/sendTyping", async (req, res) => {
    const { chatId, duration } = req.body;
    const name = resolveName(req);

    if (!chatId) {
      return res.status(400).json({ error: "chatId is required" });
    }

    const session = manager.get(name);
    if (!session || session.getStatus() !== "WORKING") {
      return res.status(503).json({ error: "Session not connected", status: manager.status(name) });
    }

    try {
      await session.sendTypingState(chatId, true);
      // Mantener typing por la duracion indicada (default 3s)
      const ms = Math.min((duration || 3) * 1000, 10000);
      setTimeout(async () => {
        try { await session.sendTypingState(chatId, false); } catch {}
      }, ms);
      res.json({ ok: true });
    } catch (err) {
      logger.error({ err, chatId, name }, "sendTyping failed");
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/sessions/start
  router.post("/api/sessions/start", async (req, res) => {
    const { name: bodyName, config } = req.body || {};
    const name = bodyName || DEFAULT_SESSION;

    // Extract webhook URL from config if provided (shared global forwarder)
    let webhookUrl = null;
    if (config?.webhooks?.length > 0) {
      webhookUrl = config.webhooks[0].url;
      if (webhookUrl) webhook.setUrl(webhookUrl);
    }

    try {
      const status = await manager.start(name, webhookUrl);
      const session = manager.get(name);
      const response = { status };

      if (status === "SCAN_QR_CODE" && session?.getQR()) {
        response.qr = await QRCode.toDataURL(session.getQR());
      }

      res.json(response);
    } catch (err) {
      logger.error({ err, name }, "Session start failed");
      res.status(500).json({ error: err.message, status: "FAILED" });
    }
  });

  // GET /api/sessions/:name
  router.get("/api/sessions/:name", (req, res) => {
    const name = resolveName(req);
    res.json({ status: manager.status(name) });
  });

  // POST /api/sessions/:name/logout
  router.post("/api/sessions/:name/logout", async (req, res) => {
    const name = resolveName(req);
    try {
      const status = await manager.logout(name);
      res.json({ status, message: "Logged out successfully" });
    } catch (err) {
      logger.error({ err, name }, "Logout failed");
      res.status(500).json({ error: err.message });
    }
  });

  // PUT /api/sessions/:name
  router.put("/api/sessions/:name", (req, res) => {
    const name = resolveName(req);
    const { config } = req.body || {};

    if (config?.webhooks?.length > 0) {
      const whUrl = config.webhooks[0].url;
      if (whUrl) webhook.setUrl(whUrl);
    }

    res.json({ status: manager.status(name), webhook: webhook.getUrl() });
  });

  // GET /api/:name/auth/qr
  router.get("/api/:name/auth/qr", async (req, res) => {
    const name = resolveName(req);
    const session = manager.get(name);
    const qrString = session?.getQR();

    if (!qrString) {
      const status = manager.status(name);
      if (status === "WORKING") {
        return res
          .status(200)
          .json({ data: null, mimetype: null, message: "Already authenticated" });
      }
      return res.status(404).json({ error: "No QR code available", status });
    }

    try {
      // Use pre-computed base64 if available, otherwise generate
      let base64 = session.getQRBase64();
      if (!base64) {
        const dataUrl = await QRCode.toDataURL(qrString, { type: "image/png" });
        base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
      }
      res.json({ data: base64, mimetype: "image/png" });
    } catch (err) {
      logger.error({ err, name }, "QR generation failed");
      res.status(500).json({ error: "Failed to generate QR code" });
    }
  });

  // GET /api/contacts/all
  router.get("/api/contacts/all", async (req, res) => {
    const name = resolveName(req);
    const session = manager.get(name);

    if (!session || session.getStatus() !== "WORKING") {
      return res
        .status(503)
        .json({ error: "Session not connected", status: manager.status(name) });
    }

    try {
      const contacts = await session.getContacts();
      res.json(contacts);
    } catch (err) {
      logger.error({ err, name }, "Get contacts failed");
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/contacts/check-exists
  router.get("/api/contacts/check-exists", async (req, res) => {
    const { phone } = req.query;
    const name = resolveName(req);

    if (!phone) {
      return res
        .status(400)
        .json({ error: "phone query parameter is required" });
    }

    const session = manager.get(name);
    if (!session || session.getStatus() !== "WORKING") {
      return res
        .status(503)
        .json({ error: "Session not connected", status: manager.status(name) });
    }

    try {
      const result = await session.checkNumberExists(phone);
      res.json(result);
    } catch (err) {
      logger.error({ err, phone, name }, "Check number failed");
      res.status(500).json({ error: err.message });
    }
  });

  // GET /health
  router.get("/health", (req, res) => {
    res.json({
      status: "ok",
      sessions: manager.list(),
      uptime: process.uptime(),
    });
  });

  return router;
}
