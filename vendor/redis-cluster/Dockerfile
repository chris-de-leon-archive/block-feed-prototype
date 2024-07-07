# For development/testing purposes only

FROM redis:7.2.4-alpine3.19

COPY ./docker/create-cluster /redis-cluster/create-cluster
COPY ./docker/config.sh /redis-cluster/config.sh
COPY ./docker/entrypoint.sh /entrypoint.sh
RUN apk update && apk upgrade && apk --no-cache add bash 

ENTRYPOINT [ "bash", "/entrypoint.sh" ]

