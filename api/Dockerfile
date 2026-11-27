# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# Migraciones: drizzle-kit necesita devDependencies, por eso es un target aparte
FROM deps AS migrator
COPY drizzle.config.ts ./
COPY drizzle ./drizzle
COPY src/db/schema.ts ./src/db/schema.ts
CMD ["npx", "drizzle-kit", "migrate"]

FROM deps AS builder
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Runner: imagen oficial de Playwright (Ubuntu + Chromium + sus librerías del sistema).
# Alpine no sirve: Chromium necesita glibc. La versión DEBE coincidir con la del paquete npm.
FROM mcr.microsoft.com/playwright:v1.65.1-noble AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=builder --chown=pwuser:pwuser /app/.next/standalone ./
COPY --from=builder --chown=pwuser:pwuser /app/.next/static ./.next/static
# El trazado de `standalone` deja fuera archivos que Playwright lee en runtime
# (playwright-core/browsers.json...): se copian los paquetes completos.
COPY --from=deps --chown=pwuser:pwuser /app/node_modules/playwright ./node_modules/playwright
COPY --from=deps --chown=pwuser:pwuser /app/node_modules/playwright-core ./node_modules/playwright-core
USER pwuser
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --retries=5   CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "server.js"]
