#!/bin/bash
set -e

if [ -z "$1" ]; then
	echo "argument 1 is required (User ID)"
	exit 1
fi

if [ -z "$2" ]; then
	echo "argument 2 is required (start port)"
	exit 1
fi

if [ -z "$3" ]; then
	echo "argument 3 is required (end port)"
	exit 1
fi

# Inserts the user
docker exec -it mysql-dev /bin/bash -c '
  mysql --password="password" --database="dev" -e"INSERT IGNORE INTO customer VALUES (\"'$1'\", DEFAULT)"
'

# Inserts some blockchains
chains=("flow" "ethereum" "starknet" "tezos" "stellar" "scroll" "optimism" "fantom")
for chain in ${chains[@]}; do
	bash ./scripts/db/blockchains/insert.sh "$chain"
done
bash ./scripts/db/blockchains/list.sh

# Inserts some webhooks
num_chains=${#chains[@]}
for ((i = $2; i <= $3; i++)); do
	rand_idx=$(($RANDOM % $num_chains))
	rand_chain=${chains[$rand_idx]}
	bash ./scripts/db/webhooks/insert.sh \
		"http://localhost:$i" \
		"$1" \
		"$rand_chain"
done
bash ./scripts/db/webhooks/list.sh
