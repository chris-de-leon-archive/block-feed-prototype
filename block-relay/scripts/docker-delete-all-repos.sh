set -e

# https://stackoverflow.com/a/59334315
HUB_TOKEN=$(
	curl -X POST -s \
		-H "Content-Type: application/json" \
		-d "{\"username\": \"$DOCKERHUB_USERNAME\", \"password\": \"$DOCKERHUB_PASSWORD\"}" \
		https://hub.docker.com/v2/users/login/ |
		jq -r .token
)

REPO_NAMES=(
	"block-feed-block-relay-rescheduling-consumer"
	"block-feed-block-relay-webhook-consumer"
	"block-feed-block-relay-block-poller-flow"
	"block-feed-block-relay-block-poller-eth"
	"block-feed-block-relay-block-receiver"
)

for repo in "${REPO_NAMES[@]}"; do
	curl -i -X DELETE \
		-H "Accept: application/json" \
		-H "Authorization: JWT $HUB_TOKEN" \
		https://hub.docker.com/v2/repositories/$DOCKERHUB_USERNAME/$repo/
done
