set -e

# For development/testing purposes only

SCHEMA_FILE="/db/schema.sql"

WORKERS_RFILE="/db/users/workers.user.sql"
WORKERS_UNAME="workers_user"
WORKERS_PWORD="password"

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
	-e"set @db='$MYSQL_DATABASE'; set @uname='$WORKERS_UNAME'; set @pword='$WORKERS_PWORD'; $(cat $WORKERS_RFILE)"

mysql \
	--password="$MYSQL_ROOT_PASSWORD" \
	--user="root" \
	"$MYSQL_DATABASE" \
	-e"set @db='$MYSQL_DATABASE'; set @uname='$API_UNAME'; set @pword='$API_PWORD'; $(cat $API_RFILE)"
