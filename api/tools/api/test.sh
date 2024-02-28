set -e

# Sample usages:
#
#   pnpm run api:test
#
#   pnpm run api:test -- refresh
#

. ./tools/utils/utils.sh

export_env_files ./env/dev
echo ""

if [ ! -z $1 ]; then
  printf "\n\nGenerating Drizzle schema...\n\n"
  pnpm run db:introspect

  printf "\n\nGenerating Open API SDK...\n\n"
  pnpm run api:sdk
fi

printf "\n\nRunning tests...\n\n"
find ./libs/api -type f -name '*.tests.ts' | tr '\n' ' ' | xargs node --require ts-node/register --test --test-reporter spec
