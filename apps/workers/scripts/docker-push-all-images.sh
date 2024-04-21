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

# Builds all the images
bash ./scripts/docker-build-all-images.sh "$IMAGE_TAG" "$CONCURRENCY"

# Defines an array of Docker image names
IMAGE_NAMES=(
	"$DOCKERHUB_USERNAME/block-feed-backend-load-balancing-webhook-load-balancer:$IMAGE_TAG"
	"$DOCKERHUB_USERNAME/block-feed-backend-processing-webhook-activator:$IMAGE_TAG"
	"$DOCKERHUB_USERNAME/block-feed-backend-processing-webhook-consumer:$IMAGE_TAG"
	"$DOCKERHUB_USERNAME/block-feed-backend-processing-webhook-flusher:$IMAGE_TAG"
	"$DOCKERHUB_USERNAME/block-feed-backend-etl-flow-block-streamer:$IMAGE_TAG"
	"$DOCKERHUB_USERNAME/block-feed-backend-etl-eth-block-streamer:$IMAGE_TAG"
)

# Uses xargs to run docker push in parallel
printf "%s\n" "${IMAGE_NAMES[@]}" | xargs -P $CONCURRENCY -I {} docker push {}
