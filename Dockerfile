FROM node:22-alpine AS builder

RUN apk add --no-cache libc6-compat

WORKDIR /app

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

ARG DATABASE_URL
ARG NUXT_PUBLIC_SITE_URL=https://cards.untestcomplique.com

ENV DATABASE_URL=$DATABASE_URL
ENV NUXT_PUBLIC_SITE_URL=$NUXT_PUBLIC_SITE_URL

RUN corepack enable && corepack prepare pnpm@10.33.4 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

COPY . .

RUN pnpm run db:migrate && pnpm run build

FROM node:22-alpine AS runner

RUN apk add --no-cache curl

WORKDIR /app

RUN --mount=type=cache,target=/root/.npm \
    echo '{"private":true}' > package.json && \
    npm install --no-package-lock drizzle-kit drizzle-orm pg tsx

COPY --from=builder /app/.output /app/.output
COPY --from=builder /app/drizzle.config.ts /app/drizzle.config.ts
COPY --from=builder /app/server/database /app/server/database

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

EXPOSE 3000

CMD ["sh", "-c", "npx drizzle-kit migrate && node .output/server/index.mjs"]
