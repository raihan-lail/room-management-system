FROM oven/bun:1.3.11 AS base

WORKDIR /app

# Install dependencies
FROM base AS install

COPY package.json bun.lock ./

RUN bun install --frozen-lockfile

# Build application
FROM base AS build

COPY --from=install /app/node_modules ./node_modules
COPY . .

# prisma7.config.ts resolves DATABASE_URL while loading the config
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"

# Generate Prisma Client
RUN bunx prisma generate

# Type-check the project
RUN bun run build

# Production runtime
FROM base AS release

ENV NODE_ENV=production

COPY --from=install /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json

# `bun run start` runs src/server.ts, so the sources are required at runtime
COPY --from=build /app/src ./src

# Prisma migrations, seeders and config are run inside this container
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma7.config.ts ./prisma7.config.ts

EXPOSE 5000

CMD ["bun", "run", "start"]
