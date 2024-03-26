#!/bin/bash
set -e

docker exec -it mysql-dev /bin/bash -c '
  mysql --password="password" --database="dev" -e"DELETE FROM webhook"
'
