# @source: https://pnpm.io/docker

FROM node:22.9.0-bullseye-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable pnpm

FROM base AS install
WORKDIR /usr/src/app
COPY ./apps ./apps
COPY ./packages ./packages
COPY ./package.json ./pnpm-lock.yaml ./pnpm-workspace.yaml ./tsconfig.json ./turbo.json ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

#################################
# stripe-webhook-event-consumer #
#################################

FROM install AS stripe-webhook-event-consumer-build
RUN pnpm build --filter=@block-feed/stripe-webhook-event-consumer && pnpm deploy --filter=@block-feed/stripe-webhook-event-consumer --prod /prod/stripe-webhook-event-consumer

FROM base AS stripe-webhook-event-consumer 
COPY --from=stripe-webhook-event-consumer-build /prod/stripe-webhook-event-consumer /prod/stripe-webhook-event-consumer
COPY --from=stripe-webhook-event-consumer-build /usr/src/app/apps/dashboard/.env /prod/stripe-webhook-event-consumer
WORKDIR /prod/stripe-webhook-event-consumer
ENV NODE_ENV=production
CMD [ "pnpm", "start" ]

#############
# dashboard #
#############

FROM install AS dashboard-build
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
RUN pnpm build --filter=@block-feed/dashboard && pnpm deploy --filter=@block-feed/dashboard --prod /prod/dashboard

FROM base AS dashboard
COPY --from=dashboard-build /prod/dashboard /prod/dashboard
COPY --from=dashboard-build /usr/src/app/apps/dashboard/.env /prod/dashboard
WORKDIR /prod/dashboard
ENV NODE_ENV=production
CMD [ "pnpm", "start" ]

#######
# web #
#######

FROM install AS web-build
RUN pnpm build --filter=@block-feed/web && pnpm deploy --filter=@block-feed/web --prod /prod/web

FROM base AS web
COPY --from=web-build /prod/web /prod/web
COPY --from=web-build /usr/src/app/apps/web/.env /prod/web
WORKDIR /prod/web
ENV NODE_ENV=production
CMD [ "pnpm", "start" ]
