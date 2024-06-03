#!/bin/bash

set -e

declare -A inputs
inputs["id"]="$1"
inputs["shard_count"]="$2"
inputs["url"]="$3"
inputs["pg_store_url"]="$4"
inputs["redis_store_url"]="$5"
inputs["redis_cluster_url"]="$6"
inputs["redis_stream_url"]="$7"

i=1
for key in "${!inputs[@]}"; do
	val=${inputs[$key]}
	if [ -z "$val" ]; then
		echo "argument $i is required: $key"
	else
		((i += 1))
	fi
done

TOTAL_SECONDS=0
PING_SECONDS=2
while ! mysqladmin --password="$MYSQL_ROOT_PASSWORD" --host="host.docker.internal" --port "3306" --user="root" ping --silent &>/dev/null; do
	echo "Waiting for database connection... ($TOTAL_SECONDS seconds)"
	sleep $PING_SECONDS
	((TOTAL_SECONDS += $PING_SECONDS))
done

echo "INSERT INTO blockchain(id, created_at, shard_count, url, pg_store_url, redis_store_url, redis_cluster_url, redis_stream_url) VALUES (\"${inputs['id']}\", DEFAULT, ${inputs['shard_count']}, \"${inputs['url']}\", \"${inputs['pg_store_url']}\", \"${inputs['redis_store_url']}\", \"${inputs['redis_cluster_url']}\", \"${inputs['redis_stream_url']}\") ON DUPLICATE KEY UPDATE shard_count=${inputs['shard_count']}, url=\"${inputs['url']}\", pg_store_url=\"${inputs['pg_store_url']}\", redis_store_url=\"${inputs['redis_store_url']}\", redis_cluster_url=\"${inputs['redis_cluster_url']}\", redis_stream_url=\"${inputs['redis_stream_url']}\";" | mysql \
	--password="$MYSQL_ROOT_PASSWORD" \
	--host="host.docker.internal" \
	--port="3306" \
	--user="root" \
	"$MYSQL_DATABASE"
