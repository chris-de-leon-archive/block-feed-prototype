ARG POSTGRES_VERSION=latest
FROM postgres:${POSTGRES_VERSION}

COPY ./tests/assets/postgres/*.sh /docker-entrypoint-initdb.d
COPY ./sql/schema.sql /sql/schema.sql

