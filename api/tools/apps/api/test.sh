set -e

. ./tools/utils/utils.sh

export_env_files ./env/dev
echo ""

if [ ! -z $1 ]; then
  printf "\n\nGenerating Open API SDK...\n\n"
  npm run openapi:gen:client
fi

printf "\n\nMigrating database...\n\n"
npm run db:migrate -- --environment "dev"

printf "\n\nRunning tests...\n\n"
find ./libs/api -type f -name '*.tests.ts' | tr '\n' ' ' | xargs node --require ts-node/register --test --test-reporter spec
