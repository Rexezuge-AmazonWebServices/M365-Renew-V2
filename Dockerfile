FROM node:24-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

COPY tsconfig.json ./
COPY src ./src
RUN npx tsc

FROM node:24-slim AS runtime

ENV NODE_ENV=production
ENV PORT=3000
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates chromium fonts-liberation \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --legacy-peer-deps \
  && npm cache clean --force

COPY --from=build /app/dist/docker-login-server.js ./dist/docker-login-server.js
COPY --from=build /app/dist/api/routes/login.js ./dist/api/routes/login.js
COPY --from=build /app/dist/utils/M365LoginUtil.js ./dist/utils/M365LoginUtil.js

EXPOSE 3000

CMD ["node", "dist/docker-login-server.js"]
