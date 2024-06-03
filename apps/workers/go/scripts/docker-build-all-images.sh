#!/bin/bash
set -e

# Defines default values for options
CONCURRENCY="${2:-1}"
IMAGE_TAG="$1"

# Makes sure the image tag is passed in
if [ -z "$IMAGE_TAG" ]; then
	echo "Image tag was not provided"
	exit 1
fi

# Defines an array of Docker build args
DOCKER_BUILD_ARGS=(
	"-t $DOCKERHUB_USERNAME/block-feed-workers-webhook-consumer:$IMAGE_TAG --build-arg BUILD_PATH=./src/apps/webhook-consumer/main.go"
	"-t $DOCKERHUB_USERNAME/block-feed-workers-block-consumer:$IMAGE_TAG --build-arg BUILD_PATH=./src/apps/block-consumer/main.go"
	"-t $DOCKERHUB_USERNAME/block-feed-workers-block-flusher:$IMAGE_TAG --build-arg BUILD_PATH=./src/apps/block-flusher/main.go"
	"-t $DOCKERHUB_USERNAME/block-feed-workers-flow-block-streamer:$IMAGE_TAG --build-arg BUILD_PATH=./src/apps/block-streamers/flow/main.go"
	"-t $DOCKERHUB_USERNAME/block-feed-workers-eth-block-streamer:$IMAGE_TAG --build-arg BUILD_PATH=./src/apps/block-streamers/eth/main.go"
)

# Uses xargs to run docker build in parallel
printf "%s\n" "${DOCKER_BUILD_ARGS[@]}" | xargs -P $CONCURRENCY -I {} sh -c 'docker build -f Dockerfile $1 .' _ {}
