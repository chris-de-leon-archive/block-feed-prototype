set -e

docker exec -it mysql-dev /bin/bash -c '
  mysql --password="password" --database="dev" -e"SELECT * FROM checkout_session ORDER BY created_at DESC, id DESC"
'

docker exec -it mysql-dev /bin/bash -c '
  mysql --password="password" --database="dev" -e"SELECT COUNT(*) AS \"Number of Checkout Sessions\" FROM checkout_session"
'
