FROM node:20-slim

WORKDIR /app

# git es requerido por dependencias transitivas de baileys
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ git \
    && git --version \
    && rm -rf /var/lib/apt/lists/*

COPY package.json .npmrc ./
RUN npm install --omit=dev --no-audit --prefer-offline || npm install --omit=dev --no-audit

COPY index.js .

ENV AUTH_DIR=/app/auth_info
ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "index.js"]
