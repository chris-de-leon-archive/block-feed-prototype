set -e

if [ -z "$1" ]; then
	echo "first argument is required (blockchain ID)"
	exit 1
fi

docker exec -it mysql-dev /bin/bash -c '
  mysql --password="password" --database="dev" -e"INSERT IGNORE INTO blockchain VALUES (\"'$1'\", \"\")"
'
