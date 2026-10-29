# POKT Community Hub images. Select a target: `web`, `worker` or `migrator`.
#
# Secrets are never baked in. The host passes them at run time through mode-600
# env files (docker-compose.yml), so an image can be shared or inspected safely.

# ── The shared install and package build ──────────────────────────────────
FROM node:24-alpine AS deps
RUN corepack enable && corepack prepare pnpm@11.25.0 --activate
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.base.json tsconfig.json ./
COPY packages ./packages
COPY apps ./apps

RUN pnpm install --frozen-lockfile

# The workspace packages resolve through `main` to dist/, so the Next build needs
# them compiled first. It only fails without this in a clean tree, which is why a
# warm local checkout never reproduces it.
RUN pnpm build \
  && test -f packages/store/dist/index.js \
  || (echo "tsc -b produced no output. Check .dockerignore excludes *.tsbuildinfo." && exit 1)

# ── The migrator ──────────────────────────────────────────────────────────
#
# Its own small image: node-pg-migrate, pg and the SQL, nothing else. The
# install is `pnpm deploy` of apps/migrator, so every version, transitive ones
# included, is the one pnpm-lock.yaml pins. (`--legacy` because the workspace
# does not inject packages; the migrator has no workspace dependencies to inject.)
FROM deps AS migrator-build
RUN pnpm --filter @community/migrator deploy --legacy --prod /out   && test -f /out/node_modules/node-pg-migrate/bin/node-pg-migrate.js   || (echo "migrator install is missing node-pg-migrate" && exit 1)

FROM node:24-alpine AS migrator
WORKDIR /app
ENV NODE_ENV=production
COPY --from=migrator-build /out/node_modules ./node_modules
COPY apps/migrator/package.json apps/migrator/migrate.mjs ./
COPY packages/store/migrations ./migrations
RUN test -n "$(ls migrations/*.sql)" || (echo "no migrations in the migrator image" && exit 1)

ARG GIT_COMMIT=unknown
ENV APP_COMMIT=${GIT_COMMIT}
LABEL org.opencontainers.image.revision=${GIT_COMMIT}

RUN addgroup -S -g 10001 community && adduser -S -u 10001 -G community community
USER community
CMD ["node", "migrate.mjs", "--dir", "migrations"]

# ── The worker ───────────────────────────────────────────────────────────
#
# `pnpm deploy` of apps/worker: its dist and a production install in which the
# workspace packages are copies of their `files` (dist only), nothing else.
FROM deps AS worker-build
RUN pnpm --filter @community/worker deploy --legacy --prod /out   && test -f /out/dist/main.js   && test -f /out/node_modules/@community/store/dist/index.js   || (echo "worker install is missing its build or a workspace package" && exit 1)

FROM node:24-alpine AS worker
WORKDIR /app
ENV NODE_ENV=production
COPY --from=worker-build /out ./

ARG GIT_COMMIT=unknown
ENV APP_COMMIT=${GIT_COMMIT}
LABEL org.opencontainers.image.revision=${GIT_COMMIT}

# The same fixed ids as web: both write to the proofs volume (the worker deletes
# expired screenshots, brief section 9.6).
RUN addgroup -S -g 10001 community && adduser -S -u 10001 -G community community   && mkdir -p /data/proofs && chown community:community /data/proofs && chmod 700 /data/proofs
USER community

CMD ["node", "dist/main.js"]

# ── The web build ─────────────────────────────────────────────────────────
FROM deps AS web-builder
# Baked as Next's deploymentId, so a tab open across a deploy reloads instead of
# mixing two builds' assets (apps/web/next.config.ts).
ARG GIT_COMMIT=unknown
ENV GIT_COMMIT=${GIT_COMMIT}
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @community/web build \
  && test -f apps/web/.next/standalone/apps/web/server.js \
  || (echo "next build produced no standalone server. Is output:'standalone' still set?" && exit 1)

# ── The web runtime ───────────────────────────────────────────────────────
#
# `output: 'standalone'` traces only what the server reaches. The layout is the
# monorepo's (outputFileTracingRoot is the workspace root), so the server lands at
# apps/web/server.js inside /app.
FROM node:24-alpine AS web
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# All interfaces INSIDE the container; nothing is published on the host, and only
# Caddy shares a network with this container (docker-compose.yml).
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

COPY --from=web-builder /app/apps/web/.next/standalone ./
# Neither is in the standalone trace (it traces code, not files served from disk).
# Without them the site renders with no CSS and no images, 200 all the way down,
# which no health check can see.
COPY --from=web-builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=web-builder /app/apps/web/public ./apps/web/public
RUN test -f apps/web/public/pokt-mark.svg && test -n "$(ls apps/web/.next/static)" \
  || (echo "static assets missing from the web image" && exit 1)

ARG GIT_COMMIT=unknown
ENV APP_COMMIT=${GIT_COMMIT}
LABEL org.opencontainers.image.revision=${GIT_COMMIT}

# Fixed ids: docker-compose.yml mounts the cache tmpfs with these, so they must not drift.
# /data/proofs is the proofs volume's mount point: a new named volume copies its owner and mode.
RUN addgroup -S -g 10001 community && adduser -S -u 10001 -G community community \
  && mkdir -p apps/web/.next/cache && chown -R community:community apps/web/.next/cache \
  && mkdir -p /data/proofs && chown community:community /data/proofs && chmod 700 /data/proofs
USER community

CMD ["node", "apps/web/server.js"]
