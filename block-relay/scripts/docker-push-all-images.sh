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
	"-t $DOCKERHUB_USERNAME/block-feed-block-relay-load-balancing-webhook-load-balancer-consumer:$IMAGE_TAG --build-arg BUILD_PATH=./src/apps/load-balancing/webhook-load-balancer-consumer/main.go"
	"-t $DOCKERHUB_USERNAME/block-feed-block-relay-processing-webhook-activation-consumer:$IMAGE_TAG --build-arg BUILD_PATH=./src/apps/processing/webhook-activation-consumer/main.go"
	"-t $DOCKERHUB_USERNAME/block-feed-block-relay-processing-webhook-consumer:$IMAGE_TAG --build-arg BUILD_PATH=./src/apps/processing/webhook-consumer/main.go"
	"-t $DOCKERHUB_USERNAME/block-feed-block-relay-processing-block-flusher:$IMAGE_TAG --build-arg BUILD_PATH=./src/apps/processing/block-flusher/main.go"
	"-t $DOCKERHUB_USERNAME/block-feed-block-relay-etl-block-consumer:$IMAGE_TAG --build-arg BUILD_PATH=./src/apps/etl/block-consumer/main.go"
	"-t $DOCKERHUB_USERNAME/block-feed-block-relay-etl-block-pollers-flow:$IMAGE_TAG --build-arg BUILD_PATH=./src/apps/etl/block-pollers/flow/main.go"
	"-t $DOCKERHUB_USERNAME/block-feed-block-relay-etl-block-pollers-eth:$IMAGE_TAG --build-arg BUILD_PATH=./src/apps/etl/block-pollers/eth/main.go"
)

# Uses xargs to run docker build in parallel
printf "%s\n" "${DOCKER_BUILD_ARGS[@]}" | xargs -P $CONCURRENCY -I {} sh -c 'docker build -f Dockerfile $1 .' _ {}

# Defines an array of Docker image names
IMAGE_NAMES=(
	"$DOCKERHUB_USERNAME/block-feed-block-relay-load-balancing-webhook-load-balancer-consumer:$IMAGE_TAG"
	"$DOCKERHUB_USERNAME/block-feed-block-relay-processing-webhook-activation-consumer:$IMAGE_TAG"
	"$DOCKERHUB_USERNAME/block-feed-block-relay-processing-webhook-consumer:$IMAGE_TAG"
	"$DOCKERHUB_USERNAME/block-feed-block-relay-processing-block-flusher:$IMAGE_TAG"
	"$DOCKERHUB_USERNAME/block-feed-block-relay-etl-block-consumer:$IMAGE_TAG"
	"$DOCKERHUB_USERNAME/block-feed-block-relay-etl-block-pollers-flow:$IMAGE_TAG"
	"$DOCKERHUB_USERNAME/block-feed-block-relay-etl-block-pollers-eth:$IMAGE_TAG"
)

# Uses xargs to run docker push in parallel
printf "%s\n" "${IMAGE_NAMES[@]}" | xargs -P $CONCURRENCY -I {} docker push {}
