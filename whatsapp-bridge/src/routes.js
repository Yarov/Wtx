import { Router } from "express";
import QRCode from "qrcode";

export function createRouter(session, webhook, logger) {
  const router = Router();

  // POST /api/sendText
  router.post("/api/sendText", async (req, res) => {
    const { chatId, text } = req.body;

    if (!chatId || !text) {
      return res.status(400).json({ error: "chatId and text are required" });
    }

    if (session.getStatus() !== "WORKING") {
      return res
        .status(503)
        .json({ error: "Session not connected", status: session.getStatus() });
    }

    try {
      const result = await session.sendText(chatId, text);
      res.json(result);
    } catch (err) {
      logger.error({ err, chatId }, "sendText failed");
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/sendImage
  router.post("/api/sendImage", async (req, res) => {
    const { chatId, url, caption, viewOnce } = req.body;

    if (!chatId || !url) {
      return res.status(400).json({ error: "chatId and url are required" });
    }

    if (session.getStatus() !== "WORKING") {
      return res
        .status(503)
        .json({ error: "Session not connected", status: session.getStatus() });
    }

    try {
      const result = await session.sendImage(chatId, url, caption || "", viewOnce !== false);
      res.json(result);
    } catch (err) {
      logger.error({ err, chatId, url }, "sendImage failed");
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/sendTyping - simular "escribiendo..."
  router.post("/api/sendTyping", async (req, res) => {
    const { chatId, duration } = req.body;

    if (!chatId) {
      return res.status(400).json({ error: "chatId is required" });
    }

    if (session.getStatus() !== "WORKING") {
      return res.status(503).json({ error: "Session not connected" });
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
      logger.error({ err, chatId }, "sendTyping failed");
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/sessions/start
  router.post("/api/sessions/start", async (req, res) => {
    const { config } = req.body || {};

    // Extract webhook URL from config if provided
    if (config?.webhooks?.length > 0) {
      const whUrl = config.webhooks[0].url;
      if (whUrl) webhook.setUrl(whUrl);
    }

    try {
      await session.start();

      const status = session.getStatus();
      const response = { status };

      if (status === "SCAN_QR_CODE" && session.getQR()) {
        response.qr = await QRCode.toDataURL(session.getQR());
      }

      res.json(response);
    } catch (err) {
      logger.error({ err }, "Session start failed");
      res.status(500).json({ error: err.message, status: "FAILED" });
    }
  });

  // GET /api/sessions/default
  router.get("/api/sessions/default", (req, res) => {
    res.json({ status: session.getStatus() });
  });

  // GET /api/default/auth/qr
  router.get("/api/default/auth/qr", async (req, res) => {
    const qrString = session.getQR();
    if (!qrString) {
      const status = session.getStatus();
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
      logger.error({ err }, "QR generation failed");
      res.status(500).json({ error: "Failed to generate QR code" });
    }
  });

  // POST /api/sessions/default/logout
  router.post("/api/sessions/default/logout", async (req, res) => {
    try {
      await session.logout();
      res.json({ status: "STOPPED", message: "Logged out successfully" });
    } catch (err) {
      logger.error({ err }, "Logout failed");
      res.status(500).json({ error: err.message });
    }
  });

  // PUT /api/sessions/default
  router.put("/api/sessions/default", (req, res) => {
    const { config } = req.body || {};

    if (config?.webhooks?.length > 0) {
      const whUrl = config.webhooks[0].url;
      if (whUrl) webhook.setUrl(whUrl);
    }

    res.json({ status: session.getStatus(), webhook: webhook.getUrl() });
  });

  // GET /api/contacts/all
  router.get("/api/contacts/all", async (req, res) => {
    if (session.getStatus() !== "WORKING") {
      return res
        .status(503)
        .json({ error: "Session not connected", status: session.getStatus() });
    }

    try {
      const contacts = await session.getContacts();
      res.json(contacts);
    } catch (err) {
      logger.error({ err }, "Get contacts failed");
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/contacts/check-exists
  router.get("/api/contacts/check-exists", async (req, res) => {
    const { phone } = req.query;

    if (!phone) {
      return res
        .status(400)
        .json({ error: "phone query parameter is required" });
    }

    if (session.getStatus() !== "WORKING") {
      return res
        .status(503)
        .json({ error: "Session not connected", status: session.getStatus() });
    }

    try {
      const result = await session.checkNumberExists(phone);
      res.json(result);
    } catch (err) {
      logger.error({ err, phone }, "Check number failed");
      res.status(500).json({ error: err.message });
    }
  });

  // GET /health
  router.get("/health", (req, res) => {
    res.json({
      status: "ok",
      session: session.getStatus(),
      uptime: process.uptime(),
    });
  });

  return router;
}
