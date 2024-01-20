set -e

. ./tools/utils/utils.sh
. ./tools/db/utils.sh

# Set development env variables
export DRIZZLE_DB_MIGRATIONS_FOLDER="./drizzle/migrations/dev"
export DRIZZLE_DB_MODE="default"

# We need to use the database that was initialized by docker compose to create a new database
export DRIZZLE_DB_NAME="dev"
export_env_files "./env/dev"
ts-node ./drizzle/scripts/recreate-database.ts

# The newly created database should exist now, let's connect to it and run migrations
export DRIZZLE_DB_NAME="block_feed"
drizzle-kit push:mysql
ts-node ./drizzle/scripts/refresh-roles.ts
