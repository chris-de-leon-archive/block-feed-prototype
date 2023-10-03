# Postgres 15 requires all connections to be secure by default, so
# we need to ensure we have the proper certs for connections as
# shown here:
# 
#   https://stackoverflow.com/a/77058727/22520608
#
# Postgres also expects the certs to be in a particular folder, so we 
# need to ensure that the certs exist at the location documented here:
#   
#   https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-CONNECT-SSLROOTCERT
#
FROM alpine:3.17 AS cert
WORKDIR /workspace
RUN apk update \
  && apk add curl \
  && mkdir -p /root/.postgresql \
  && curl -o /root/.postgresql/root.crt https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem \
  && /usr/sbin/update-ca-certificates

FROM node:20.7.0-alpine3.17 AS deps
ENV NODE_ENV=production
ARG PROJECT_NAME
ENV PROJECT_NAME ${PROJECT_NAME}
WORKDIR /workspace
COPY ./dist/apps/${PROJECT_NAME}/package.json ./
RUN npm i --omit=dev

FROM node:20.7.0-alpine3.17 AS runner
ENV NODE_ENV=production
ARG PROJECT_NAME
ENV PROJECT_NAME ${PROJECT_NAME}
WORKDIR /workspace
COPY ./dist/apps/${PROJECT_NAME} ./dist/apps/${PROJECT_NAME}
COPY --from=deps ./workspace/node_modules ./node_modules
COPY --from=cert /root/.postgresql /root/.postgresql
ENTRYPOINT node ./dist/apps/${PROJECT_NAME}/main.js