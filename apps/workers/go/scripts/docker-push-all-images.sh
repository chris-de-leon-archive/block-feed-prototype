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
	"$DOCKERHUB_USERNAME/block-feed-workers-webhook-consumer:$IMAGE_TAG"
	"$DOCKERHUB_USERNAME/block-feed-workers-block-consumer:$IMAGE_TAG"
	"$DOCKERHUB_USERNAME/block-feed-workers-block-flusher:$IMAGE_TAG"
	"$DOCKERHUB_USERNAME/block-feed-workers-flow-block-streamer:$IMAGE_TAG"
	"$DOCKERHUB_USERNAME/block-feed-workers-eth-block-streamer:$IMAGE_TAG"
)

# Uses xargs to run docker push in parallel
printf "%s\n" "${IMAGE_NAMES[@]}" | xargs -P $CONCURRENCY -I {} docker push {}
