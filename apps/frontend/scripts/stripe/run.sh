set -e

. ./scripts/utils/utils.sh

export_env_files .
echo ""

if [ "$1" = "pricing" ]; then
	ts-node ./scripts/stripe/create-product-and-price.ts
	exit 0
fi

echo "Invalid command: $1"
exit 1
