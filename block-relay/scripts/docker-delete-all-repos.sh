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
	"block-feed-block-relay-load-balancing-webhook-load-balancer-consumer"
	"block-feed-block-relay-processing-webhook-activation-consumer"
	"block-feed-block-relay-processing-webhook-consumer"
	"block-feed-block-relay-processing-block-flusher"
	"block-feed-block-relay-etl-block-consumer"
	"block-feed-block-relay-etl-block-pollers-flow"
	"block-feed-block-relay-etl-block-pollers-eth"
)

for repo in "${REPO_NAMES[@]}"; do
	curl -i -X DELETE \
		-H "Accept: application/json" \
		-H "Authorization: JWT $HUB_TOKEN" \
		https://hub.docker.com/v2/repositories/$DOCKERHUB_USERNAME/$repo/
done
