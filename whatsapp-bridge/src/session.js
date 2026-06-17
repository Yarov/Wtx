import pkg from "whatsapp-web.js";
const { Client, LocalAuth, MessageMedia } = pkg;
import QRCode from "qrcode";
import fs from "fs/promises";
import { existsSync } from "fs";

const MAX_RECONNECT_RETRIES = 5;

export class Session {
  constructor(logger, authStateDir, onMessage, sessionId = "default") {
    this.logger = logger;
    this.authStateDir = authStateDir;
    this.onMessage = onMessage;
    this.sessionId = sessionId;

    this.client = null;
    this.status = "STOPPED";
    this.qrString = null;
    this.qrBase64 = null;
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    this.messageQueue = [];
    this.isSending = false;
    this.lastSendTime = 0;
    this.shutdownRequested = false;
  }

  async start() {
    if (this.status === "WORKING") {
      this.logger.info("Session already connected");
      return;
    }

    if (this.status === "STARTING") {
      this.logger.info("Session already starting, skipping duplicate start");
      return;
    }

    this.shutdownRequested = false;
    this.status = "STARTING";
    this.qrString = null;
    this.qrBase64 = null;

    // Clean up previous client if any
    if (this.client) {
      try {
        await this.client.destroy();
      } catch {
        // ignore cleanup errors
      }
      this.client = null;
    }

    try {
      await fs.mkdir(this.authStateDir, { recursive: true });

      // Clean stale Chromium lock files from previous container runs
      // (scoped to this session's clientId only — never touches other sessions)
      await this._cleanChromiumLocks();

      this.client = new Client({
        authStrategy: new LocalAuth({ clientId: this.sessionId, dataPath: this.authStateDir }),
        puppeteer: {
          headless: true,
          args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-accelerated-2d-canvas",
            "--no-first-run",
            "--disable-gpu",
            "--disable-features=LockProfileCookieDatabase",
          ],
          executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        },
      });

      this._setupEventHandlers();

      this.logger.info("Initializing WhatsApp client...");
      await this.client.initialize();
    } catch (err) {
      this.logger.error({ err }, "Failed to start session");
      this.status = "FAILED";
      throw err;
    }
  }

  _setupEventHandlers() {
    // QR code received — needs scanning
    this.client.on("qr", async (qr) => {
      this.qrString = qr;
      this.status = "SCAN_QR_CODE";
      this.logger.info("New QR code generated");

      try {
        const dataUrl = await QRCode.toDataURL(qr, { type: "image/png" });
        this.qrBase64 = dataUrl.replace(/^data:image\/png;base64,/, "");
      } catch (err) {
        this.logger.error({ err }, "Failed to generate QR base64");
      }
    });

    // Client is ready (authenticated and connected)
    this.client.on("ready", async () => {
      this.status = "WORKING";
      this.qrString = null;
      this.qrBase64 = null;
      this.reconnectAttempts = 0;
      this.logger.info("WhatsApp client is ready");

      // Detectar typing interceptando el WebSocket interno de WhatsApp Web
      try {
        // Interceptar frames del WebSocket para detectar presencia "composing"
        await this.client.pupPage.evaluate(() => {
          if (window.__typingHooked) return;
          window.__typingHooked = true;

          // Hookear WebSocket.prototype.send para capturar frames entrantes
          const origSend = WebSocket.prototype.send;
          // Necesitamos hookear el onmessage de la instancia existente
          // Buscar el WebSocket activo de WhatsApp
          const origAddEventListener = EventTarget.prototype.addEventListener;
          EventTarget.prototype.addEventListener = function(type, listener, options) {
            if (this instanceof WebSocket && type === "message") {
              const wrappedListener = function(event) {
                try {
                  if (typeof event.data === "string" && event.data.includes("composing")) {
                    // Extraer el chatId del frame
                    const match = event.data.match(/"from":"([^"]+)".*"type":"composing"/);
                    if (match) {
                      console.log("__TYPING__:" + match[1]);
                    }
                  }
                } catch(e) {}
                return listener.call(this, event);
              };
              return origAddEventListener.call(this, type, wrappedListener, options);
            }
            return origAddEventListener.call(this, type, listener, options);
          };
        });

        // Capturar console.log del browser
        this.client.pupPage.on("console", (consoleMsg) => {
          const text = consoleMsg.text();
          if (text.startsWith("__TYPING__:")) {
            const chatId = text.replace("__TYPING__:", "").trim();
            this._handleTyping(chatId);
          }
        });

        this.logger.info("Typing detection hooked via WebSocket intercept");
      } catch (err) {
        this.logger.warn({ err: err.message }, "Could not hook typing detection (non-critical)");
      }
    });

    // Successfully authenticated
    this.client.on("authenticated", () => {
      this.logger.info("WhatsApp client authenticated");
    });

    // Authentication failure
    this.client.on("auth_failure", (msg) => {
      this.logger.error({ msg }, "Authentication failed");
      this.status = "FAILED";
      this.qrString = null;
      this.qrBase64 = null;
      this._clearAuthState();
    });

    // Disconnected
    this.client.on("disconnected", (reason) => {
      this.logger.warn({ reason }, "WhatsApp client disconnected");
      this.status = "STOPPED";
      this.qrString = null;
      this.qrBase64 = null;

      if (reason === "LOGOUT") {
        this.logger.info("Logged out, clearing auth state");
        this._clearAuthState();
        return;
      }

      // Attempt reconnection with backoff
      if (!this.shutdownRequested && this.reconnectAttempts < MAX_RECONNECT_RETRIES) {
        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000);
        this.logger.info(
          { attempt: this.reconnectAttempts, delay, reason },
          "Scheduling reconnect"
        );
        this.status = "STARTING";
        this.reconnectTimer = setTimeout(() => this.start(), delay);
      } else if (this.reconnectAttempts >= MAX_RECONNECT_RETRIES) {
        this.logger.error("Max reconnect attempts reached");
        this.status = "FAILED";
      }
    });

    // Incoming message
    this.client.on("message", (msg) => {
      this._handleIncomingMessage(msg);
    });

    // Outgoing message (sent from phone) - para capturar mensajes manuales
    this.client.on("message_create", (msg) => {
      if (msg.fromMe) {
        this._handleIncomingMessage(msg);
      }
    });

    // Mensaje eliminado para todos
    this.client.on("message_revoke_everyone", async (after, before) => {
      try {
        const deletedBy = after.from || before?.from;
        if (!deletedBy || deletedBy === "status@broadcast") return;

        let phone = deletedBy;
        if (phone.endsWith("@lid")) {
          const contact = await after.getContact();
          phone = contact?.number ? `${contact.number}@c.us` : phone;
        }

        this.onMessage({
          event: "message_revoked",
          session: this.sessionId,
          payload: {
            from: phone,
            fromMe: after.fromMe || false,
            originalBody: before?.body || "",
            timestamp: after.timestamp || Math.floor(Date.now() / 1000),
          },
        });
      } catch (err) {
        this.logger.warn({ err: err.message }, "Error handling revoked message");
      }
    });

    // Typing indicator
    this.client.on("message_reaction", () => {}); // keep alive
    this.typingState = {};
    this.client.on("chat", async (chat) => {
      // whatsapp-web.js no tiene evento typing directo,
      // se detecta via polling del chat state
    });
  }

  _handleTyping(chatId) {
    // Debounce: no enviar multiples typing del mismo chat
    const now = Date.now();
    if (this.typingState[chatId] && now - this.typingState[chatId] < 3000) return;
    this.typingState[chatId] = now;

    // Resolver LID si es necesario
    let phone = chatId.replace("@c.us", "").replace("@s.whatsapp.net", "").replace("@lid", "");

    this.logger.info({ chatId: phone }, "Contact is typing");

    // Enviar al webhook como evento de typing
    this.onMessage({
      event: "typing",
      session: this.sessionId,
      payload: { from: chatId, typing: true },
    });
  }

  /**
   * Enviar estado "escribiendo..." al contacto antes de responder
   */
  async sendTypingState(chatId, isTyping = true) {
    try {
      if (!this.client || this.status !== "WORKING") return;
      const chat = await this.client.getChatById(chatId);
      if (isTyping) {
        await chat.sendStateTyping();
      } else {
        await chat.clearState();
      }
    } catch (err) {
      this.logger.warn({ err: err.message }, "Could not set typing state");
    }
  }

  async _handleIncomingMessage(msg) {
    try {
      // Skip status broadcasts
      if (msg.from === "status@broadcast") return;
      // Skip group messages
      if (msg.from?.endsWith("@g.us")) return;

      const contact = await msg.getContact();

      // Resolve phone number
      let fromPhone = msg.from;
      if (msg.fromMe) {
        // Mensaje saliente: el "to" es el contacto
        fromPhone = msg.to || msg.from;
      }

      if (fromPhone.endsWith("@lid")) {
        const realNumber =
          contact?.number ||
          msg._data?.from?.user ||
          msg._data?.author?.replace("@s.whatsapp.net", "").replace("@c.us", "") ||
          null;
        if (realNumber) {
          fromPhone = `${realNumber}@c.us`;
          this.logger.info({ lid: msg.from, resolved: fromPhone }, "Resolved LID to phone");
        }
      }

      // Construir texto del mensaje
      let text = msg.body || "";
      let mediaUrl = null;
      let mediaType = null;

      // Si tiene media, intentar descargarla
      if (msg.hasMedia) {
        try {
          const media = await msg.downloadMedia();
          if (media) {
            mediaType = media.mimetype;
            // Guardar media temporalmente y generar URL
            const fs = await import("fs");
            const path = await import("path");
            const ext = media.mimetype?.split("/")[1]?.split(";")[0] || "bin";
            const filename = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
            const mediaDir = "/app/uploads/received";
            await fs.promises.mkdir(mediaDir, { recursive: true });
            const filePath = path.default.join(mediaDir, filename);
            await fs.promises.writeFile(filePath, Buffer.from(media.data, "base64"));
            mediaUrl = `/uploads/received/${filename}`;
          }
        } catch (err) {
          this.logger.warn({ err: err.message, fromMe: msg.fromMe }, "Could not download media");
          mediaType = msg._data?.mimetype || "image/jpeg";
        }
        if (!text) text = `[${mediaType?.startsWith("image") ? "Imagen" : mediaType?.startsWith("video") ? "Video" : "Archivo"}]`;
      }

      // Si hay media pero no se pudo descargar, marcar como media sin URL
      if (msg.hasMedia && !mediaUrl) {
        mediaType = mediaType || msg._data?.mimetype || "unknown";
        mediaUrl = "__pending__";  // Indicador de que hay media pero no se descargo
      }
      if (!text && !mediaUrl) return;

      // Quoted message (referencia/respuesta a otro mensaje)
      let quotedMsg = null;
      if (msg.hasQuotedMsg) {
        try {
          const quoted = await msg.getQuotedMessage();
          if (quoted) {
            quotedMsg = {
              body: quoted.body || "",
              fromMe: quoted.fromMe || false,
            };
          }
        } catch (err) {
          // ignore
        }
      }

      const payload = {
        event: "message",
        session: this.sessionId,
        payload: {
          from: fromPhone,
          body: text,
          timestamp: msg.timestamp || Math.floor(Date.now() / 1000),
          fromMe: msg.fromMe || false,
          hasMedia: msg.hasMedia || false,
          mediaUrl: mediaUrl,
          mediaType: mediaType,
          quotedMsg: quotedMsg,
          id: { id: msg.id?.id || msg.id?._serialized || null },
          pushName: contact?.pushname || msg._data?.notifyName || null,
        },
      };

      this.onMessage(payload);
    } catch (err) {
      this.logger.error({ err, from: msg?.from }, "Error handling incoming message");
    }
  }

  async sendText(chatId, text) {
    return new Promise((resolve, reject) => {
      this.messageQueue.push({ chatId, text, resolve, reject });
      this._processQueue();
    });
  }

  async sendImage(chatId, imageUrl, caption = "", viewOnce = true) {
    return new Promise((resolve, reject) => {
      this.messageQueue.push({ chatId, imageUrl, caption, viewOnce, isMedia: true, resolve, reject });
      this._processQueue();
    });
  }

  async _processQueue() {
    if (this.isSending || this.messageQueue.length === 0) return;
    this.isSending = true;

    while (this.messageQueue.length > 0) {
      const item = this.messageQueue.shift();
      const { chatId, resolve, reject } = item;

      // Enforce minimum 1s between sends
      const now = Date.now();
      const elapsed = now - this.lastSendTime;
      if (elapsed < 1000) {
        await new Promise((r) => setTimeout(r, 1000 - elapsed));
      }

      try {
        if (!this.client || this.status !== "WORKING") {
          throw new Error("Session not connected");
        }

        let result;
        if (item.isMedia && item.imageUrl) {
          // Enviar imagen - soporta URL remota o archivo local
          let media;
          if (item.imageUrl.startsWith("/") || item.imageUrl.startsWith("./")) {
            // Archivo local
            const fs = await import("fs");
            const path = await import("path");
            const filePath = item.imageUrl.startsWith("/") ? item.imageUrl : path.default.resolve(item.imageUrl);
            const data = fs.default.readFileSync(filePath).toString("base64");
            const ext = path.default.extname(filePath).replace(".", "");
            const mimeTypes = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp" };
            media = new MessageMedia(mimeTypes[ext] || "image/jpeg", data);
          } else {
            media = await MessageMedia.fromUrl(item.imageUrl, { unsafeMime: true });
          }
          // View Once: la foto solo se puede ver una vez
          result = await this.client.sendMessage(chatId, media, {
            caption: item.caption || "",
            isViewOnce: item.viewOnce !== false,
          });
          this.logger.info({ chatId, viewOnce: item.viewOnce !== false }, "Image sent");
        } else {
          // Enviar texto
          result = await this.client.sendMessage(chatId, item.text);
        }

        this.lastSendTime = Date.now();
        resolve({ sent: true, id: result?.id?._serialized || null });
      } catch (err) {
        this.logger.error({ err, chatId }, "Failed to send message");
        reject(err);
      }
    }

    this.isSending = false;
  }

  async getContacts() {
    if (!this.client || this.status !== "WORKING") {
      throw new Error("Session not connected");
    }

    const contacts = await this.client.getContacts();

    const userContacts = contacts.filter((c) => c.isUser && !c.isMe && !c.isGroup);

    // Fetch profile pictures in parallel (with graceful fallback)
    const result = await Promise.all(
      userContacts.map(async (c) => {
        let profilePicUrl = null;
        try {
          profilePicUrl = await c.getProfilePicUrl();
        } catch {
          // Private or unavailable — ignore
        }
        return {
          id: c.id._serialized,
          name: c.name || c.pushname || null,
          notify: c.pushname || null,
          pushName: c.pushname || null,
          profilePicUrl: profilePicUrl || null,
        };
      })
    );

    this.logger.info(
      { returned: result.length, totalRaw: contacts.length },
      "Contacts requested"
    );

    return result;
  }

  async checkNumberExists(phone) {
    if (!this.client || this.status !== "WORKING") {
      throw new Error("Session not connected");
    }

    try {
      const numberId = await this.client.getNumberId(phone);
      return {
        numberExists: !!numberId,
        jid: numberId?._serialized || null,
      };
    } catch (err) {
      this.logger.error({ err, phone }, "Error checking number");
      return { numberExists: false, jid: null };
    }
  }

  async logout() {
    try {
      if (this.client) {
        await this.client.logout();
        await this.client.destroy();
      }
    } catch (err) {
      this.logger.warn({ err }, "Error during logout");
    }
    this.client = null;
    this.status = "STOPPED";
    this.qrString = null;
    this.qrBase64 = null;
    await this._clearAuthState();
  }

  async shutdown() {
    this.shutdownRequested = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    try {
      if (this.client) {
        await this.client.destroy();
      }
    } catch {
      // ignore
    }
    this.client = null;
    this.status = "STOPPED";
  }

  // Directory that holds this session's auth/profile state.
  // whatsapp-web.js's LocalAuth stores each clientId under `session-<clientId>`.
  get _sessionDir() {
    return `${this.authStateDir}/session-${this.sessionId}`;
  }

  async _cleanChromiumLocks() {
    try {
      const lockNames = ["SingletonLock", "SingletonCookie", "SingletonSocket"];
      // Only clean locks within THIS session's own profile dir — never touch others.
      const queue = [this._sessionDir];

      while (queue.length > 0) {
        const dir = queue.shift();
        let entries;
        try {
          entries = await fs.readdir(dir, { withFileTypes: true });
        } catch {
          continue;
        }
        for (const entry of entries) {
          const full = `${dir}/${entry.name}`;
          if (lockNames.includes(entry.name)) {
            await fs.rm(full, { force: true }).catch(() => {});
            this.logger.info({ file: full }, "Removed stale Chromium lock");
          } else if (entry.isDirectory()) {
            queue.push(full);
          }
        }
      }
    } catch (err) {
      this.logger.warn({ err }, "Error cleaning Chromium locks (non-fatal)");
    }
  }

  async _clearAuthState() {
    try {
      // Only remove THIS session's own profile dir — never touch other sessions.
      const dir = this._sessionDir;
      if (existsSync(dir)) {
        await fs.rm(dir, { recursive: true, force: true });
        this.logger.info({ dir }, "Auth state cleared");
      }
    } catch (err) {
      this.logger.error({ err }, "Failed to clear auth state");
    }
  }

  getStatus() {
    return this.status;
  }

  getQR() {
    return this.qrString;
  }

  getQRBase64() {
    return this.qrBase64;
  }
}
