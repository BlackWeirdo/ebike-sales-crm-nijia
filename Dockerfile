# Node 24 — built-in node:sqlite cần Node >= 22 (dùng 24 cho ổn định).
FROM node:24-slim

WORKDIR /app

# Cài deps (gồm devDeps: cần vite để build + tsx để chạy server .ts).
COPY package.json package-lock.json ./
RUN npm ci

# Copy mã nguồn + build client → /app/dist.
COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV NODE_OPTIONS=--disable-warning=ExperimentalWarning
# DB nằm trên volume bền (Fly mount /data). PORT do Fly cấp.
ENV CRM_DB_PATH=/data/crm.db
ENV PORT=3001
EXPOSE 3001

CMD ["npx", "tsx", "server/index.ts"]
