RANDM_UUID="$(uuidgen)"
IMAGE_NAME="redis-cluster:$RANDM_UUID"

cleanup() {
	docker stop $RANDM_UUID
	docker image rm $IMAGE_NAME
}

trap cleanup EXIT

set -e

START_PORT=7001
END_PORT=7006

docker build \
	-t "$IMAGE_NAME" \
	.

docker run --rm -d \
	--init \
	--name "$RANDM_UUID" \
	-e START_PORT="$START_PORT" \
	-e END_PORT="$END_PORT" \
	-p "$START_PORT-$END_PORT":"$START_PORT-$END_PORT" \
	"$IMAGE_NAME"

docker exec -it "$RANDM_UUID" /bin/sh
