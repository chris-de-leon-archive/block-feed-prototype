set -e

# For development/testing purposes only

TRIGGERS_FILE="/db/triggers.sql"
SCHEMA_FILE="/db/schema.sql"

BLOCK_RELAY_RFILE="/db/users/block-relay.user.sql"
BLOCK_RELAY_UNAME="block_relay_user"
BLOCK_RELAY_PWORD="password"

API_RFILE="/db/users/api.user.sql"
API_UNAME="api_user"
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
	<"$TRIGGERS_FILE"

mysql \
	--password="$MYSQL_ROOT_PASSWORD" \
	--user="root" \
	"$MYSQL_DATABASE" \
	-e"set @db='$MYSQL_DATABASE'; set @uname='$BLOCK_RELAY_UNAME'; set @pword='$BLOCK_RELAY_PWORD'; $(cat $BLOCK_RELAY_RFILE)"

mysql \
	--password="$MYSQL_ROOT_PASSWORD" \
	--user="root" \
	"$MYSQL_DATABASE" \
	-e"set @db='$MYSQL_DATABASE'; set @uname='$API_UNAME'; set @pword='$API_PWORD'; $(cat $API_RFILE)"
