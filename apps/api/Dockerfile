# syntax=docker/dockerfile:1
# Obraz API Finso. Budowany z katalogu głównego repozytorium (monorepo):
#   docker build -f apps/api/Dockerfile -t finso-api .
# Przy starcie: migracje bazy, kategorie systemowe (idempotentnie), serwer.

FROM node:22-slim AS build
# pnpm w wersji z package.json (pole packageManager) przez Corepack.
RUN corepack enable
WORKDIR /repo
# prisma generate (postinstall API) wczytuje prisma.config.ts, który wymaga
# DATABASE_URL — nie łączy się z bazą, więc w etapie budowania wystarczy atrapa.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
COPY . .
# Tylko API i to, od czego zależy (@vireo/shared, @vireo/config).
RUN pnpm install --frozen-lockfile --filter "api..."
RUN pnpm --filter @vireo/shared build && pnpm --filter api build

FROM node:22-slim
RUN corepack enable
ENV NODE_ENV=production
WORKDIR /repo
# Zależności deweloperskie zostają celowo: prisma (migrate deploy) i tsx (seed)
# są potrzebne przy starcie. Mniejszy obraz to optymalizacja na później.
COPY --from=build /repo /repo
WORKDIR /repo/apps/api
# Hosting podaje PORT; domyślnie 3000.
EXPOSE 3000
USER node
CMD ["pnpm", "start:release"]
