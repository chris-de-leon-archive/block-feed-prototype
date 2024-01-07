set -e

. ./tools/utils/utils.sh

export_env_files "./env/dev"
echo ""

if [ "$1" = "token" ]; then
  ts-node ./tools/auth0/get-token.ts
  exit 0
fi

if [ "$1" = "clean" ]; then
  ts-node ./tools/auth0/remove-all-users.ts
  exit 0
fi

echo "Invalid command: $1"
exit 1
