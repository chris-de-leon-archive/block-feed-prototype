set -e

# For development/testing purposes only

SCHEMA_FILE="/db/schema.sql"

BLOCK_RELAY_RFILE="/db/roles/block-relay.role.sql"
BLOCK_RELAY_UNAME="block_relay_role"
BLOCK_RELAY_PWORD="password"

API_RFILE="/db/roles/api.role.sql"
API_UNAME="api_role"
API_PWORD="password"

mysql \
	--password="$MYSQL_ROOT_PASSWORD" \
	--user="root" \
	"$MYSQL_DATABASE" \
	<"$SCHEMA_FILE"

mysql \
	--password="$MYSQL_ROOT_PASSWORD" \
	--user="root" \
	"$MYSQL_DATABASE" \
	-e"set @uname='$BLOCK_RELAY_UNAME'; set @pword='$BLOCK_RELAY_PWORD'; $(cat $BLOCK_RELAY_RFILE)"

mysql \
	--password="$MYSQL_ROOT_PASSWORD" \
	--user="root" \
	"$MYSQL_DATABASE" \
	-e"set @uname='$API_UNAME'; set @pword='$API_PWORD'; $(cat $API_RFILE)"
