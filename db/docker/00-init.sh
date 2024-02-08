set -e

# For development/testing purposes only

SCHEMA_FILE="/db/schema.sql"
SCHEMA_NAME="block_feed"

BLOCK_RELAY_RFILE="/db/roles/block-relay.role.sql"
BLOCK_RELAY_UNAME="block_relay_role"
BLOCK_RELAY_PWORD="password"

API_RFILE="/db/roles/api.role.sql"
API_UNAME="api_role"
API_PWORD="password"

psql \
	--username "$POSTGRES_USER" \
	--dbname "$POSTGRES_DB" \
	-v ON_ERROR_STOP=1 \
	<<-EOSQL
		    CREATE SCHEMA IF NOT EXISTS "$SCHEMA_NAME";
	EOSQL

PGOPTIONS="--search_path=$SCHEMA_NAME" psql \
	--username "$POSTGRES_USER" \
	--dbname "$POSTGRES_DB" \
	--single-transaction \
	-v ON_ERROR_STOP=1 \
	-f "$SCHEMA_FILE"

psql \
	--username "$POSTGRES_USER" \
	--dbname "$POSTGRES_DB" \
	--single-transaction \
	-v ON_ERROR_STOP=1 \
	-v schema="$SCHEMA_NAME" \
	-v uname="$BLOCK_RELAY_UNAME" \
	-v pword="$BLOCK_RELAY_PWORD" \
	-f "$BLOCK_RELAY_RFILE"

psql \
	--username "$POSTGRES_USER" \
	--dbname "$POSTGRES_DB" \
	--single-transaction \
	-v ON_ERROR_STOP=1 \
	-v schema="$SCHEMA_NAME" \
	-v uname="$API_UNAME" \
	-v pword="$API_PWORD" \
	-f "$API_RFILE"
