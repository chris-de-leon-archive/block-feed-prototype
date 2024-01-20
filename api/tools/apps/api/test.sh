set -e

. ./tools/utils/utils.sh

export_env_files ./env/dev
echo ""

if [ ! -z $1 ]; then
  printf "\n\nGenerating Open API SDK...\n\n"
  npm run openapi:gen:client
fi

# TODO: tests should be run using testcontainer: https://node.testcontainers.org/quickstart/
printf "\n\nMigrating database...\n\n"
npm run db:push

printf "\n\nRunning tests...\n\n"
find ./libs/api -type f -name '*.tests.ts' | tr '\n' ' ' | xargs node --require ts-node/register --test --test-reporter spec
