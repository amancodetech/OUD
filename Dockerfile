# Multi-stage Dockerfile for Oud ERP
FROM node:22-alpine AS base

# Install OpenSSL and libc6-compat for Prisma and Alpine compatibility
RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# Dependencies stage
FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npm ci

# Builder stage
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build Next.js application
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

# Runner stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy built application and dependencies
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts/create-admin.mjs ./scripts/create-admin.mjs
COPY --from=builder /app/src/lib/prisma-client.mjs ./src/lib/prisma-client.mjs
COPY --from=builder /app/scripts/server-entry.mjs ./scripts/server-entry.mjs
COPY --from=builder /app/scripts/validate-runtime.mjs ./scripts/validate-runtime.mjs
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Make entrypoint script or chown
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

CMD ["node", "scripts/server-entry.mjs"]
