FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY app/package.json app/
RUN npm ci --workspace=api --workspace=@ptw/shared --include-workspace-root

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/tsconfig.base.json ./tsconfig.base.json
COPY packages/shared packages/shared
COPY app app
RUN npm run build -w @ptw/shared && npm run build -w api

FROM node:22-alpine AS runner
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY app/package.json app/
RUN npm ci --workspace=api --workspace=@ptw/shared --include-workspace-root
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/app/dist ./app/dist
EXPOSE 4000
CMD ["node", "app/dist/main.js"]
