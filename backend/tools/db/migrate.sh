set -e

. ./tools/utils/utils.sh

if [ -z $1 ] || [ "$1" == "development" ]; then
  export_env_files "./env/$1"
  echo ""

  drizzle-kit push:pg
  exit 0
fi

if [ "$1" == "staging" ] || [ "$1" == "production" ]; then
  export_env_files "./env/$1"
  echo ""

  drizzle-kit generate:pg
  ts-node ./drizzle/migrate.ts
  exit 0
fi

echo "Usage: $0 <development | staging | production>"
exit 1
