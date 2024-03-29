set -e

# For development/testing purposes only

BLOCKSTORE_RFILE="/db/users/blockstore.user.sql"
BLOCKSTORE_UNAME="blockstore"
BLOCKSTORE_PWORD="password"

# To change the default schema, you can use:
#
#   PGOPTIONS="--search_path=$SCHEMA_NAME" psql ...
#
SCHEMA_NAME=${POSTGRES_SCHEMA:="block_feed"}

psql \
	--username "$POSTGRES_USER" \
	--dbname "$POSTGRES_DB" \
	-v ON_ERROR_STOP=1 \
	<<-EOSQL
		CREATE SCHEMA IF NOT EXISTS "$SCHEMA_NAME";
	EOSQL

psql \
	--username "$POSTGRES_USER" \
	--dbname "$POSTGRES_DB" \
	--single-transaction \
	-v ON_ERROR_STOP=1 \
	-v schema="$SCHEMA_NAME" \
	-v uname="$BLOCKSTORE_UNAME" \
	-v pword="$BLOCKSTORE_PWORD" \
	-f "$BLOCKSTORE_RFILE"
