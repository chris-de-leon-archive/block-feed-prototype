FROM golang:1.21.3-alpine3.18 AS builder
ARG BUILD_PATH
WORKDIR /workspace
COPY ./src ./src
COPY ./go.mod ./
COPY ./go.sum ./
RUN go build -o bin ${BUILD_PATH}

FROM alpine:3.18.4
WORKDIR /workspace
COPY --from=builder /workspace/bin /workspace/bin
CMD ["/workspace/bin"]