FROM node:20-slim

WORKDIR /app

# Dependencias del sistema que necesita Baileys
RUN apt-get update && apt-get install -y \
    python3 make g++ git \
    && rm -rf /var/lib/apt/lists/*

COPY package.json .
RUN npm install --omit=dev

COPY index.js .

ENV AUTH_DIR=/app/auth_info

EXPOSE 3000

CMD ["node", "index.js"]
