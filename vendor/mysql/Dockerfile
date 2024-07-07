# For development/testing purposes only

ARG MYSQL_VERSION=latest
FROM mysql:${MYSQL_VERSION}

COPY ./docker/entrypoint/*.sh /docker-entrypoint-initdb.d/
COPY ./docker/utils/*.sh /db/utils/
COPY ./users/*.sql /db/users/
COPY ./schema.sql /db/schema.sql

