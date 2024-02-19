set -e

MONGO_VERSION="7.0.5"
RANDM_UUID="$(uuidgen)"
IMAGE_NAME="db:$RANDM_UUID"

cleanup() {
	docker stop $RANDM_UUID
	docker image rm $IMAGE_NAME
}

trap cleanup EXIT

docker build \
	-t "$IMAGE_NAME" \
	--build-arg MONGO_VERSION="$MONGO_VERSION" \
	.

docker run --rm -d \
	-e MONGO_AUTO_INIT="true" \
	-p 27017:27017 \
	--name "$RANDM_UUID" \
	"$IMAGE_NAME"

docker exec -it "$RANDM_UUID" /bin/bash
