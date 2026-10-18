FROM node:22-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/package.json
COPY mobile/package.json mobile/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN npm ci --workspace @raahi/server --workspace @raahi/contracts --include-workspace-root
COPY server server
COPY packages/contracts packages/contracts
RUN npm --workspace @raahi/server run db:generate && npm run build

FROM build AS migrate
WORKDIR /app/server
ENTRYPOINT ["../node_modules/.bin/prisma", "migrate", "deploy"]

FROM build AS pruned
RUN npm prune --omit=dev --workspace @raahi/server --workspace @raahi/contracts

FROM node:22-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=pruned --chown=node:node /app/node_modules node_modules
COPY --from=pruned --chown=node:node /app/server server
COPY --from=pruned --chown=node:node /app/packages packages
RUN mkdir -p /data/uploads /data/verification && chown -R node:node /data
ENV NODE_ENV=production PORT=4000 UPLOAD_DIR=/data/uploads VERIFICATION_DIR=/data/verification
USER node
WORKDIR /app/server
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD node -e "fetch('http://127.0.0.1:4000/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
