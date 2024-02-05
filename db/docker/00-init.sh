set -e

SCHEMA_FILE="/sql/schema.sql"
SCHEMA_NAME="block_feed"

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
