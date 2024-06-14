FROM golang:1.22.2-bullseye AS build
ARG BUILD_DIR
WORKDIR /usr/src/app
COPY ./apps ./apps
COPY ./packages/go ./packages/go
COPY ./go.work ./go.work.sum ./
WORKDIR /usr/src/app/${BUILD_DIR}
RUN --mount=type=cache,target="/go/pkg/mod" \
  go mod download -x && \
  go build -o /workspace/bin ./main.go

FROM debian:11.9-slim
WORKDIR /workspace
COPY --from=build /workspace/bin /workspace/bin

# The bullseye docker image doesn't come with ca-certificates by default :(
# We need to install it manually:
#
#  https://github.com/debuerreotype/docker-debian-artifacts/issues/15#issuecomment-634423712
#
RUN apt-get update \
  && apt-get upgrade \
  && apt-get install -y --no-install-recommends ca-certificates \
  && update-ca-certificates \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/* 

ENTRYPOINT ["/workspace/bin"]
