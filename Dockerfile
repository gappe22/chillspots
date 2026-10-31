FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY app ./app
COPY assets ./assets
COPY components ./components
COPY constants ./constants
COPY hooks ./hooks
COPY lib ./lib
COPY shared ./shared
COPY public ./public
COPY app.json babel.config.js metro.config.js tsconfig.json ./
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3001 CHILLSPOTS_DATA_FILE=/app/data/chillspots.json
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force && mkdir /app/data && chown node:node /app/data
COPY --from=build /app/dist ./dist
COPY server ./server
USER node
EXPOSE 3001
VOLUME ["/app/data"]
CMD ["node", "server/index.mjs"]
