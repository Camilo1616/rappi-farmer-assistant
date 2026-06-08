FROM node:20-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    python3 make g++ git curl \
    && rm -rf /var/lib/apt/lists/*

COPY package.json .
RUN npm install --omit=dev

COPY index.js .

ENV AUTH_DIR=/app/auth_info
ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "index.js"]
