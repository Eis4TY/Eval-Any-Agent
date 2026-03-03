# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=20

FROM --platform=$TARGETPLATFORM node:${NODE_VERSION}-bookworm-slim AS deps
WORKDIR /app
RUN npm config set registry https://mirrors.tuna.tsinghua.edu.cn/npm/
COPY package.json package-lock.json ./
RUN npm ci

FROM --platform=$TARGETPLATFORM node:${NODE_VERSION}-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run db:generate && npm run build

FROM --platform=$TARGETPLATFORM node:${NODE_VERSION}-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV APP_PORT=3000

RUN apt-get update \
  && apt-get install -y --no-install-recommends sqlite3 ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN npm config set registry https://mirrors.tuna.tsinghua.edu.cn/npm/
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY prisma ./prisma
RUN npm run db:generate

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/docker/entrypoint.sh /app/docker/entrypoint.sh

RUN chmod +x /app/docker/entrypoint.sh \
  && mkdir -p /app/data

EXPOSE 3000

ENTRYPOINT ["/app/docker/entrypoint.sh"]
