FROM node:20-slim

WORKDIR /app

# Chromium y dependencias para Puppeteer headless
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    ca-certificates \
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
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

COPY package.json .
RUN npm install --omit=dev --no-audit

COPY index.js .

ENV AUTH_DIR=/app/auth_info
ENV NODE_ENV=production

# Crear el directorio de sesiones para que Railway pueda montarlo como volumen persistente
RUN mkdir -p /app/auth_info

VOLUME ["/app/auth_info"]

EXPOSE 3000

CMD ["node", "index.js"]
