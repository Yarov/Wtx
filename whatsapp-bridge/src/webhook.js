const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

export class WebhookForwarder {
  constructor(logger, token = "") {
    this.logger = logger;
    this.webhookUrl = null;
    this.token = token;
  }

  setUrl(url) {
    this.webhookUrl = url;
    this.logger.info({ url }, "Webhook URL configured");
  }

  getUrl() {
    return this.webhookUrl;
  }

  async forward(payload) {
    if (!this.webhookUrl) {
      this.logger.warn("No webhook URL configured, dropping message");
      return;
    }

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const headers = { "Content-Type": "application/json" };
        if (this.token) {
          headers["X-Webhook-Token"] = this.token;
        }
        const response = await fetch(this.webhookUrl, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10000),
        });

        if (response.ok) {
          this.logger.info(
            { status: response.status, from: payload?.payload?.from },
            "Webhook delivered"
          );
          return;
        }

        this.logger.warn(
          { status: response.status, attempt },
          "Webhook returned non-OK status"
        );
      } catch (err) {
        this.logger.error(
          { err: err.message, attempt },
          "Webhook delivery failed"
        );
      }

      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      }
    }

    this.logger.error(
      { url: this.webhookUrl, from: payload?.payload?.from },
      "Webhook delivery exhausted all retries"
    );
  }
}
