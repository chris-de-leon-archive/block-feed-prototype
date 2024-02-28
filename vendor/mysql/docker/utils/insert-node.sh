#!/bin/bash

set -e

NODE_URL="$1"
CHAIN_ID="$2"

if [ -z "$NODE_URL" ]; then
	echo "Missing first argument (node URL)"
	exit 1
fi

if [ -z "$CHAIN_ID" ]; then
	echo "Missing first argument (node URL)"
	exit 1
fi

TOTAL_SECONDS=0
PING_SECONDS=2
while ! mysqladmin --password="$MYSQL_ROOT_PASSWORD" --host="host.docker.internal" --port "3306" --user="root" ping --silent &>/dev/null; do
	echo "Waiting for database connection... ($TOTAL_SECONDS seconds)"
	sleep $PING_SECONDS
	((TOTAL_SECONDS += $PING_SECONDS))
done

echo "INSERT IGNORE INTO blockchain VALUES (\"$CHAIN_ID\", \"\");" | mysql \
	--password="$MYSQL_ROOT_PASSWORD" \
	--host="host.docker.internal" \
	--port="3306" \
	--user="root" \
	"$MYSQL_DATABASE"

echo "INSERT IGNORE INTO webhook_node VALUES (UUID(), DEFAULT, \"$NODE_URL\", \"$CHAIN_ID\");" | mysql \
	--password="$MYSQL_ROOT_PASSWORD" \
	--host="host.docker.internal" \
	--port="3306" \
	--user="root" \
	"$MYSQL_DATABASE"
