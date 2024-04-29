#!/bin/bash

# https://stackoverflow.com/a/59334315
set -e
HUB_TOKEN=$(
	curl -X POST -s \
		-H "Content-Type: application/json" \
		-d "{\"username\": \"$DOCKERHUB_USERNAME\", \"password\": \"$DOCKERHUB_PASSWORD\"}" \
		https://hub.docker.com/v2/users/login/ |
		jq -r .token
)
set +e

REPO_NAMES=(
	"block-feed-backend-webhook-consumer"
	"block-feed-backend-block-consumer"
	"block-feed-backend-block-flusher"
	"block-feed-backend-flow-block-streamer"
	"block-feed-backend-eth-block-streamer"
)

for repo in "${REPO_NAMES[@]}"; do
	curl -i -X DELETE \
		-H "Accept: application/json" \
		-H "Authorization: JWT $HUB_TOKEN" \
		https://hub.docker.com/v2/repositories/$DOCKERHUB_USERNAME/$repo/
done
