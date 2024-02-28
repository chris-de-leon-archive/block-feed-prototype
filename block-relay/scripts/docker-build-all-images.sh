#!/bin/bash
set -e

# Defines default values for options
CONCURRENCY="5"
IMAGE_TAG="$1"

# Makes sure the image tag is passed in
if [ -z "$IMAGE_TAG" ]; then
	echo "Image tag was not provided"
	exit 1
fi

# Defines an array of Docker build args
DOCKER_BUILD_ARGS=(
	"-t $DOCKERHUB_USERNAME/block-feed-block-relay-webhook-load-balancer-consumer:$IMAGE_TAG --build-arg BUILD_PATH=./src/apps/webhook-load-balancer-consumer/main.go"
	"-t $DOCKERHUB_USERNAME/block-feed-block-relay-webhook-activation-consumer:$IMAGE_TAG --build-arg BUILD_PATH=./src/apps/webhook-activation-consumer/main.go"
	"-t $DOCKERHUB_USERNAME/block-feed-block-relay-webhook-consumer:$IMAGE_TAG --build-arg BUILD_PATH=./src/apps/webhook-consumer/main.go"
	"-t $DOCKERHUB_USERNAME/block-feed-block-relay-caching-consumer:$IMAGE_TAG --build-arg BUILD_PATH=./src/apps/caching-consumer/main.go"
	"-t $DOCKERHUB_USERNAME/block-feed-block-relay-block-flusher:$IMAGE_TAG --build-arg BUILD_PATH=./src/apps/block-flusher/main.go"
	"-t $DOCKERHUB_USERNAME/block-feed-block-relay-block-poller-flow:$IMAGE_TAG --build-arg BUILD_PATH=./src/apps/block-poller/flow/main.go"
	"-t $DOCKERHUB_USERNAME/block-feed-block-relay-block-poller-eth:$IMAGE_TAG --build-arg BUILD_PATH=./src/apps/block-poller/eth/main.go"
)

# Uses xargs to run docker build in parallel
printf "%s\n" "${DOCKER_BUILD_ARGS[@]}" | xargs -P $CONCURRENCY -I {} sh -c 'docker build -f Dockerfile $1 .' _ {}
