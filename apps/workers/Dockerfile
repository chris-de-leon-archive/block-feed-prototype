FROM golang:1.22.2-bullseye AS base
WORKDIR /workspace
COPY go.mod go.sum ./
RUN --mount=type=cache,target="/go/pkg/mod" go mod download -x
COPY ./src ./src

FROM base AS builder
ARG BUILD_PATH
RUN --mount=type=cache,target="/go/pkg/mod" go build -o bin ${BUILD_PATH}

FROM debian:bullseye
WORKDIR /workspace
COPY --from=builder /workspace/bin /workspace/bin

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

CMD ["/workspace/bin"]
