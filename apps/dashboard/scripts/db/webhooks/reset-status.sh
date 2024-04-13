set -e

docker exec -it mysql-dev /bin/bash -c '
  mysql --password="password" --database="dev" -e"UPDATE webhook SET is_active = 0, is_queued = 0"
'
