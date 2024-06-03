# @source: https://pnpm.io/docker

FROM node:21.7.3-bullseye-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable pnpm

FROM base AS build
WORKDIR /usr/src/app
COPY ./apps ./apps
COPY ./packages ./packages
COPY ./package.json ./pnpm-lock.yaml ./pnpm-workspace.yaml ./tsconfig.json ./turbo.json ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm build \
  --filter=@block-feed/workers-ts-stripe-webhook-event-consumer \
  --filter=@block-feed/dashboard \
  --filter=@block-feed/web \
  && pnpm deploy --filter=@block-feed/workers-ts-stripe-webhook-event-consumer --prod /prod/workers/ts/stripe-webhook-event-consumer \
  && pnpm deploy --filter=@block-feed/dashboard --prod /prod/dashboard \
  && pnpm deploy --filter=@block-feed/web --prod /prod/web

FROM base AS stripe-webhook-event-consumer 
COPY --from=build /prod/workers/ts/stripe-webhook-event-consumer /prod/workers/ts/stripe-webhook-event-consumer
WORKDIR /prod/workers/ts/stripe-webhook-event-consumer
CMD [ "pnpm", "start" ]

FROM base AS dashboard
COPY --from=build /prod/dashboard /prod/dashboard
WORKDIR /prod/dashboard
CMD [ "pnpm", "start" ]

FROM base AS web
COPY --from=build /prod/web /prod/web
WORKDIR /prod/web
CMD [ "pnpm", "start" ]
