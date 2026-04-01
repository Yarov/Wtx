import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;
import QRCode from "qrcode";
import fs from "fs/promises";
import { existsSync } from "fs";

const MAX_RECONNECT_RETRIES = 5;

export class Session {
  constructor(logger, authStateDir, onMessage) {
    this.logger = logger;
    this.authStateDir = authStateDir;
    this.onMessage = onMessage;

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
      await this._cleanChromiumLocks();

      this.client = new Client({
        authStrategy: new LocalAuth({ dataPath: this.authStateDir }),
        puppeteer: {
          headless: true,
          args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-accelerated-2d-canvas",
            "--no-first-run",
            "--disable-gpu",
            "--single-process",
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
    this.client.on("ready", () => {
      this.status = "WORKING";
      this.qrString = null;
      this.qrBase64 = null;
      this.reconnectAttempts = 0;
      this.logger.info("WhatsApp client is ready");
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
  }

  async _handleIncomingMessage(msg) {
    try {
      // Skip status broadcasts
      if (msg.from === "status@broadcast") return;

      // Only handle text messages (no media for now)
      const text = msg.body;
      if (!text) return;

      const contact = await msg.getContact();

      const payload = {
        event: "message",
        session: "default",
        payload: {
          from: msg.from,
          body: text,
          timestamp: msg.timestamp || Math.floor(Date.now() / 1000),
          fromMe: msg.fromMe || false,
          hasMedia: msg.hasMedia || false,
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

  async _processQueue() {
    if (this.isSending || this.messageQueue.length === 0) return;
    this.isSending = true;

    while (this.messageQueue.length > 0) {
      const { chatId, text, resolve, reject } = this.messageQueue.shift();

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
        const result = await this.client.sendMessage(chatId, text);
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

  async _cleanChromiumLocks() {
    try {
      const lockNames = ["SingletonLock", "SingletonCookie", "SingletonSocket"];
      const queue = [this.authStateDir];

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
      if (existsSync(this.authStateDir)) {
        const entries = await fs.readdir(this.authStateDir);
        await Promise.all(
          entries.map((entry) =>
            fs.rm(`${this.authStateDir}/${entry}`, { recursive: true, force: true })
          )
        );
        this.logger.info("Auth state cleared");
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
