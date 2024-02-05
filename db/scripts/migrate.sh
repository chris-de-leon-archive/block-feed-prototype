set -e

# Defines helper variables
DB_URL="postgres://rootuser:password@host.docker.internal:5432/dev?sslmode=disable"
CONTAINER_NAME=$(uuidgen)
DB_SCHEMA="block_feed"

# Makes sure the container is destroyed once this script exits
trap "docker stop $CONTAINER_NAME" EXIT

# Creates a postgres container
docker run --rm -d \
	--name "$CONTAINER_NAME" \
	-p 5432:5432 \
	-e POSTGRES_USER=rootuser \
	-e POSTGRES_PASSWORD=password \
	-e POSTGRES_DB=dev \
	postgres:16.1-alpine3.18

# Waits for postgres to come online
sleep 2

# Generates a database migration
atlas schema clean --url $DB_URL --auto-approve
docker exec -i "$CONTAINER_NAME" psql $DB_URL --single-transaction -v ON_ERROR_STOP=1 -c "CREATE SCHEMA IF NOT EXISTS \"$DB_SCHEMA\";"
atlas migrate diff --dir "file://./migrations" --to "file://./schema.sql" --dev-url "$DB_URL&search_path=$DB_SCHEMA"
