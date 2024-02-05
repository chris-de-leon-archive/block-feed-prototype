ARG POSTGRES_VERSION=latest
FROM postgres:${POSTGRES_VERSION}

COPY ./docker/*.sh /docker-entrypoint-initdb.d
COPY ./schema.sql /sql/schema.sql

