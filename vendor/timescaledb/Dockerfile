# For development/testing purposes only

ARG PG_VERSION=latest-pg16
FROM timescale/timescaledb:${PG_VERSION}

COPY ./docker/entrypoint/*.sh /docker-entrypoint-initdb.d/
COPY ./users/*.sql /db/users/

