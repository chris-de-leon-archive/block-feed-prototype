set -e

# Drizzle configs
DRIZZLE_SCHEMA_OUTPUT_PATH="./libs/shared/database/src/lib/schema/generated"
DRIZZLE_TMP_CONF_FILE_NAME="tmp.drizzle.config.ts"

# Docker configs
PG_VERSION="16.1-alpine3.18"
RANDM_UUID="$(uuidgen)"
IMAGE_NAME="db:$RANDM_UUID"

# Postgres configs
POSTGRES_SCHEMA="block_feed"
POSTGRES_UNAME="rootuser"
POSTGRES_PWORD="password"
POSTGRES_PORT="5432"
POSTGRES_DB="drizzle"

# Defines a helper function for cleaning up resources
cleanup() {
  docker stop "$RANDM_UUID"
  docker image rm "$IMAGE_NAME"
  rm "$DRIZZLE_TMP_CONF_FILE_NAME"
}

# Cleans up the image, container, and temporary drizzle config file once this script exits
trap cleanup EXIT

# Builds a custom postgres image with our setup scripts
docker build \
  -t "$IMAGE_NAME" \
  --build-arg POSTGRES_VERSION="$PG_VERSION" \
  "$(git rev-parse --show-toplevel)"/db

# Creates a database container and applies the setup scripts
docker run --rm -d \
  -e POSTGRES_PASSWORD="$POSTGRES_PWORD" \
  -e POSTGRES_USER="$POSTGRES_UNAME" \
  -e POSTGRES_DB="$POSTGRES_DB" \
  -p $POSTGRES_PORT:$POSTGRES_PORT \
  --name "$RANDM_UUID" \
  "$IMAGE_NAME"

# Waits for the database to come online
sleep 3

# The --schemaFilter flag is broken if you use the introspect:pg command without a config file:
#
#   https://www.answeroverflow.com/m/1144751274852626493
#
# Drizzle also ignores the `search_path` url parameter if it is included in the connection string :/
#
# Right now, the current workaround is to create a temporary drizzle config file for introspection
#
cat <<EOF >"$DRIZZLE_TMP_CONF_FILE_NAME"
import type { Config } from "drizzle-kit";
export default {
  out: "$DRIZZLE_SCHEMA_OUTPUT_PATH",
  driver: "pg",
  verbose: true,
  schemaFilter: "$POSTGRES_SCHEMA",
  dbCredentials: {
    connectionString: "postgresql://$POSTGRES_UNAME:$POSTGRES_PWORD@host.docker.internal:$POSTGRES_PORT/$POSTGRES_DB?sslmode=disable",
  },
} satisfies Config;
EOF

# Generates a drizzle schema
drizzle-kit introspect:pg --config="$DRIZZLE_TMP_CONF_FILE_NAME"
