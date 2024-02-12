# For development/testing purposes only

ARG MYSQL_VERSION=latest
FROM mysql:${MYSQL_VERSION}

COPY ./docker/*.sh /docker-entrypoint-initdb.d
COPY ./roles/*.sql /db/roles/
COPY ./schema.sql /db/schema.sql

