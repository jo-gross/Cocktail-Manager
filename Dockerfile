FROM node:24-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/
RUN corepack enable pnpm && corepack prepare --activate && pnpm i --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production
ARG DEPLOYMENT
ENV DEPLOYMENT=${DEPLOYMENT:-$NODE_ENV}
ARG DEMO_MODE
ENV DEMO_MODE=${DEMO_MODE:-false}
ENV NEXT_TELEMETRY_DISABLED=1

RUN corepack enable pnpm && corepack prepare --activate && pnpm run build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ARG DEPLOYMENT
ENV DEPLOYMENT=${DEPLOYMENT:-$NODE_ENV}
ARG DEMO_MODE
ENV DEMO_MODE=${DEMO_MODE:-false}
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
RUN mkdir .next
RUN chown nextjs:nodejs .next

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/config ./config
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/prisma.config.ts ./

COPY --from=deps /app/node_modules ./node_modules

RUN apk add --no-cache wget

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV LANG=C.UTF-8
ENV LC_ALL=C.UTF-8

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD corepack enable pnpm && corepack prepare --activate && pnpm prisma migrate deploy && HOSTNAME="0.0.0.0" node server.js
