set -e

PG_VERSION="16.1-alpine3.18"
RANDM_UUID="$(uuidgen)"
IMAGE_NAME="db:$RANDM_UUID"

cleanup() {
	docker stop $RANDM_UUID
	docker image rm $IMAGE_NAME
}

trap cleanup EXIT

docker build \
	-t "$IMAGE_NAME" \
	--build-arg POSTGRES_VERSION="$PG_VERSION" \
	.

docker run --rm -d \
	-e POSTGRES_PASSWORD="password" \
	-e POSTGRES_USER="rootuser" \
	-e POSTGRES_DB="dev" \
	-p 5432:5432 \
	--name "$RANDM_UUID" \
	"$IMAGE_NAME"

docker exec -it "$RANDM_UUID" /bin/bash \
	-c 'sleep 2 && psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB"'
