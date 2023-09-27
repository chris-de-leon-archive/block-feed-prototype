FROM node:18.12.0-alpine AS deps
ENV NODE_ENV=production
ARG PROJECT_NAME
ENV PROJECT_NAME ${PROJECT_NAME}
WORKDIR /api
COPY ./dist/apps/${PROJECT_NAME}/package.json ./
RUN npm i --omit=dev

FROM node:18.12.0-alpine AS runner
ENV NODE_ENV=production
ARG PROJECT_NAME
ENV PROJECT_NAME ${PROJECT_NAME}
WORKDIR /api
COPY ./dist/apps/${PROJECT_NAME} ./dist/apps/${PROJECT_NAME}
COPY --from=deps ./api/node_modules ./node_modules
ENTRYPOINT node ./dist/apps/${PROJECT_NAME}/main.js