set -e

# For development/testing purposes only

TRIGGERS_FILE="/db/triggers.sql"
SCHEMA_FILE="/db/schema.sql"

BACKEND_RFILE="/db/users/backend.user.sql"
BACKEND_UNAME="backend_user"
BACKEND_PWORD="password"

FRONTEND_RFILE="/db/users/frontend.user.sql"
FRONTEND_UNAME="frontend_user"
FRONTEND_PWORD="password"

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
	-e"set @db='$MYSQL_DATABASE'; set @uname='$BACKEND_UNAME'; set @pword='$BACKEND_PWORD'; $(cat $BACKEND_RFILE)"

mysql \
	--password="$MYSQL_ROOT_PASSWORD" \
	--user="root" \
	"$MYSQL_DATABASE" \
	-e"set @db='$MYSQL_DATABASE'; set @uname='$FRONTEND_UNAME'; set @pword='$FRONTEND_PWORD'; $(cat $FRONTEND_RFILE)"
