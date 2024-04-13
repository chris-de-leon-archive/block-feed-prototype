set -e

docker exec -it mysql-dev /bin/bash -c '
  mysql --password="password" --database="dev" -e"SELECT * FROM blockchain"
'

docker exec -it mysql-dev /bin/bash -c '
  mysql --password="password" --database="dev" -e"SELECT COUNT(*) AS \"Number of Chains\" FROM blockchain"
'
