FROM golang:1.21.6-alpine3.18 AS builder
WORKDIR /workspace
COPY ./go.mod ./
COPY ./go.sum ./
COPY ./src ./src
ARG BUILD_PATH
RUN go build -o bin ${BUILD_PATH}

FROM alpine:3.18.4
WORKDIR /workspace
COPY --from=builder /workspace/bin /workspace/bin
CMD ["/workspace/bin"]
