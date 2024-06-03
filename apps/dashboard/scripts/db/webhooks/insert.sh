set -e

if [ -z "$1" ]; then
	echo "argument 1 is required (url)"
	exit 1
fi

if [ -z "$2" ]; then
	echo "argument 2 is required (customer_id)"
	exit 1
fi

if [ -z "$3" ]; then
	echo "argument 3 is required (blockchain_id)"
	exit 1
fi

rand_max_blocks=$(((RANDOM % 10) + 1))
rand_max_retries=$(((RANDOM % 10) + 1))
rand_max_timeout_ms=$(((RANDOM % 10000) + 1000))
rand_shard_id=$((RANDOM % 4))
docker exec -it mysql-dev /bin/bash -c '
  mysql --password="password" --database="dev" -e"INSERT IGNORE INTO webhook VALUES (UUID(), DEFAULT, 0, \"'$1'\", '$rand_max_blocks', '$rand_max_retries', '$rand_max_timeout_ms', \"'$2'\", \"'$3'\", '$rand_shard_id')"
'
