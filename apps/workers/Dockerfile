FROM golang:1.21.6-alpine3.18 AS base
WORKDIR /workspace
COPY go.mod go.sum ./
RUN --mount=type=cache,target="/go/pkg/mod" go mod download -x
COPY ./src ./src

FROM base AS builder
ARG BUILD_PATH
RUN --mount=type=cache,target="/go/pkg/mod" go build -o bin ${BUILD_PATH}

FROM alpine:3.18.4
WORKDIR /workspace
COPY --from=builder /workspace/bin /workspace/bin
CMD ["/workspace/bin"]
