set -e

if [ -z "$1" ]; then
	echo "argument 1 is required (blockchain ID)"
	exit 1
fi

if [ -z "$2" ]; then
	echo "argument 2 is required (shard count)"
	exit 1
fi

if [ -z "$3" ]; then
	echo "argument 3 is required (url)"
	exit 1
fi

if [ -z "$4" ]; then
	echo "argument 4 is required (pg store url)"
	exit 1
fi

if [ -z "$5" ]; then
	echo "argument 5 is required (redis store url)"
	exit 1
fi

if [ -z "$6" ]; then
	echo "argument 6 is required (redis cluster url)"
	exit 1
fi

if [ -z "$7" ]; then
	echo "argument 7 is required (redis stream url)"
	exit 1
fi

docker exec -it mysql-dev /bin/bash -c '
  mysql --password="password" --database="dev" -e"INSERT IGNORE INTO blockchain VALUES (\"'$1'\", DEFAULT, '$2', \"'$3'\", \"'$4'\", \"'$5'\", \"'$6'\", \"'$7'\")"
'
