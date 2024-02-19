set -e

MYSQL_VERSION="8.3.0"
RANDM_UUID="$(uuidgen)"
IMAGE_NAME="db:$RANDM_UUID"

cleanup() {
	docker stop $RANDM_UUID
	docker image rm $IMAGE_NAME
}

trap cleanup EXIT

docker build \
	-t "$IMAGE_NAME" \
	--build-arg MYSQL_VERSION="$MYSQL_VERSION" \
	.

docker run --rm -d \
	-e MYSQL_ROOT_PASSWORD="password" \
	-e MYSQL_DATABASE="dev" \
	-e MYSQL_PASSWORD="password" \
	-e MYSQL_USER="rootuser" \
	-p 3306:3306 \
	--name "$RANDM_UUID" \
	"$IMAGE_NAME"

docker exec -it "$RANDM_UUID" /bin/bash \
	-c 'sleep 15 && mysql --password="$MYSQL_ROOT_PASSWORD" --host="host.docker.internal" --port="3306" --user="root" "$MYSQL_DATABASE"'
