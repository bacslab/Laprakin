# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY client/package.json ./client/package.json
COPY server/package.json ./server/package.json
RUN npm ci

COPY . .
# The production VM has a small memory footprint; give Vite a bounded heap and
# let the host's configured swap absorb the peak during the client transform.
RUN NODE_OPTIONS=--max-old-space-size=640 npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update \
  && apt-get install -y --no-install-recommends poppler-utils \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/server ./server
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/client/dist ./client/dist

RUN mkdir -p /app/server/data /app/server/uploads /app/server/public-media \
  && chown -R node:node /app

USER node
EXPOSE 4000
CMD ["node", "server/src/index.js"]
