# For development/testing purposes only

# Allow test cases to dynamically change the version:
#
#   https://docs.docker.com/build/guide/build-args/#change-runtime-versions
#
ARG MONGO_VERSION=latest
FROM mongo:${MONGO_VERSION}

# Copies custom setup scripts
#
COPY ./docker /docker

# We need a keyfile to enable authentication on a replica set:
#
#   https://www.mongodb.com/docs/manual/tutorial/enforce-keyfile-access-control-in-existing-replica-set/#enforce-keyfile-access-control-on-existing-replica-set
#
RUN openssl rand -base64 756 > /mongodb.key && chmod 400 /mongodb.key

# Overrides the default entrypoint so that we can add more customization
#
# If this is here, the docker entrypoint initialization scripts won't be run automatically
#
ENTRYPOINT [ "bash", "/docker/entrypoint.sh" ]
