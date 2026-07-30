FROM node:22-alpine
WORKDIR /app
COPY package.json next.config.ts tsconfig.json postcss.config.mjs ./
COPY public ./public
COPY src ./src
RUN npm install && npm run build
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "run", "start"]
