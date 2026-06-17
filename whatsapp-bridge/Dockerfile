FROM node:20-slim

# Install Chromium and dependencies for whatsapp-web.js (Puppeteer)
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libgdk-pixbuf2.0-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    curl \
    gosu \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev 2>/dev/null || npm install --omit=dev

COPY . .

RUN mkdir -p /app/auth_data /app/uploads/received && chown -R node:node /app

# Entrypoint: fix volume permissions at runtime, then drop to node user
RUN printf '#!/bin/sh\nmkdir -p /app/uploads/received\nchown -R node:node /app/uploads 2>/dev/null || true\nexec gosu node "$@"\n' > /app/entrypoint.sh && \
    chmod +x /app/entrypoint.sh

ENV NODE_ENV=production
ENV PORT=3080
ENV AUTH_STATE_DIR=/app/auth_data

EXPOSE 3080

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3080/health || exit 1

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["node", "src/index.js"]
