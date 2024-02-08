set -e

# Sample usage: npm run api:test -- openapi drizzle

. ./tools/utils/utils.sh

export_env_files ./env/dev
echo ""

if [ ! -z $1 ]; then
  printf "\n\nGenerating Open API SDK...\n\n"
  npm run openapi:gen:client
fi

if [ ! -z $2 ]; then
  printf "\n\nGenerating Drizzle schema...\n\n"
  npm run db:introspect
fi

printf "\n\nRunning tests...\n\n"
find ./libs/api -type f -name '*.tests.ts' | tr '\n' ' ' | xargs node --require ts-node/register --test --test-reporter spec
