ARG POSTGRES_VERSION=latest
FROM postgres:${POSTGRES_VERSION}

COPY ./docker/*.sh /docker-entrypoint-initdb.d
COPY ./roles/*.sql /db/roles/
COPY ./schema.sql /db/schema.sql

