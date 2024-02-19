set -e

# Defines helper variables
DB_NAME="block_feed"
DB_URL="mysql://root:password@host.docker.internal:3306/$DB_NAME"
RANDM_UUID="$(uuidgen)"

# Makes sure the container is destroyed once this script exits
trap "docker stop $RANDM_UUID" EXIT

# Creates a mysql container
docker run --rm -d \
	-e MYSQL_ROOT_PASSWORD="password" \
	-e MYSQL_DATABASE="$DB_NAME" \
	-e MYSQL_PASSWORD="password" \
	-e MYSQL_USER="rootuser" \
	-p 3306:3306 \
	--name "$RANDM_UUID" \
	"mysql:8.3.0"

# Waits for mysql to come online
sleep 15

# Makes sure the database is clean before generating the migration
atlas schema clean --url "$DB_URL" --auto-approve

# Generates a new migration
atlas migrate diff \
	--dir "file://./migrations" \
	--to "file://./schema.sql" \
	--dev-url "$DB_URL"
