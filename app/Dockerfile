FROM node:22-alpine
WORKDIR /app
# Prefer building from monorepo root via docker compose (context: .).
COPY package.json nest-cli.json tsconfig.json drizzle.config.ts ./
COPY src ./src
RUN npm install && npx nest build
ENV NODE_ENV=production
EXPOSE 4000
CMD ["node", "dist/main.js"]
