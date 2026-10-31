# syntax=docker/dockerfile:1

# ------------------ BUILD ----------------
FROM node:24-slim AS build
WORKDIR /app

COPY package*.json ./
# --ignore-scripts: postinstall (prisma generate) would fail here
# as the schema has not yet been copied. The client is generated explicitly further down
RUN npm ci --ignore-scripts

COPY . .

# prisma.config.ts demands DATABASE_URL even for generating the client,
# so we use a dummy value just for this step.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" npx prisma generate \
    && npm run build

# ------------------ RUNTIME ----------------
FROM node:24-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

# The engine schema of Prisma (used on migrate deploy) needs openssl
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

# The client comes pre-compiled inside the `dist` folder,
# so the `postinstall` step is not needed.
# @prisma/engines works here, as root, because the 'node' user can't write
# to node_modules during execution.
RUN npm ci --omit=dev --ignore-scripts \
    && npm rebuild @prisma/engines bcrypt \
    && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY prisma ./prisma
COPY prisma.config.ts ./

USER node
EXPOSE 3000

# Apply pending migrations and start the API
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/src/main"]