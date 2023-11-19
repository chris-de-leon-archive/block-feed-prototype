set -e

. ./tools/utils/utils.sh

export_env_files ./env/dev
echo ""

if [ ! -z $1 ]; then
  npm run openapi:gen:client
fi

find ./libs/api -type f -name '*.tests.ts' | tr '\n' ' ' | xargs node --require ts-node/register --test --test-reporter spec
