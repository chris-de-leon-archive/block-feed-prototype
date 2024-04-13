PG_VERSION="latest-pg16"
RANDM_UUID="$(uuidgen)"
IMAGE_NAME="db:$RANDM_UUID"

cleanup() {
	docker stop $RANDM_UUID
	docker image rm $IMAGE_NAME
}

trap cleanup EXIT

set -e

docker build \
	-t "$IMAGE_NAME" \
	--build-arg PG_VERSION="$PG_VERSION" \
	.

docker run --rm -d \
	-e POSTGRES_PASSWORD="password" \
	-e POSTGRES_USER="rootuser" \
	-e POSTGRES_DB="dev" \
	-p 5432:5432 \
	--name "$RANDM_UUID" \
	"$IMAGE_NAME"

sleep 3

docker exec -it "$RANDM_UUID" /bin/bash
