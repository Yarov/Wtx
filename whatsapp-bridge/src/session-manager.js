import { Session } from "./session.js";

/**
 * Manages multiple WhatsApp sessions, one per profile.
 * Each session is identified by a `sessionId` (e.g. "perfil_5", "default").
 *
 * The webhook forwarder is shared (single instance) — every session forwards
 * to the same backend webhook, and each payload carries its own `session`
 * field so the backend can tell them apart.
 */
export class SessionManager {
  constructor(logger, authStateDir, onMessage) {
    this.logger = logger;
    this.authStateDir = authStateDir;
    this.onMessage = onMessage;
    this.sessions = new Map();
  }

  /**
   * Returns the existing Session for `sessionId`, or creates a new one.
   */
  getOrCreate(sessionId) {
    let session = this.sessions.get(sessionId);
    if (!session) {
      session = new Session(
        this.logger.child({ session: sessionId }),
        this.authStateDir,
        this.onMessage,
        sessionId
      );
      this.sessions.set(sessionId, session);
      this.logger.info({ sessionId }, "Session created");
    }
    return session;
  }

  get(sessionId) {
    return this.sessions.get(sessionId);
  }

  /**
   * Starts (or restarts) a session. The webhook URL is shared globally and is
   * configured by the caller on the WebhookForwarder; it is accepted here for
   * API symmetry / future per-session routing.
   */
  async start(sessionId, _webhookUrl, phoneNumber = null) {
    const session = this.getOrCreate(sessionId);
    await session.start(phoneNumber);
    return session.getStatus();
  }

  status(sessionId) {
    const session = this.sessions.get(sessionId);
    return session ? session.getStatus() : "STOPPED";
  }

  async logout(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return "STOPPED";
    await session.logout();
    this.sessions.delete(sessionId);
    this.logger.info({ sessionId }, "Session logged out and removed");
    return "STOPPED";
  }

  async shutdownAll() {
    await Promise.all(
      Array.from(this.sessions.values()).map((s) =>
        s.shutdown().catch((err) =>
          this.logger.warn({ err: err.message }, "Error shutting down session")
        )
      )
    );
  }

  /**
   * Returns a map of { sessionId: status, ... } for all known sessions.
   */
  list() {
    const out = {};
    for (const [id, session] of this.sessions.entries()) {
      out[id] = session.getStatus();
    }
    return out;
  }
}
