set -e

. ./tools/utils/utils.sh

export_env_files ./env/development
echo ""

find ./libs/block-gateway -name '*.test.ts' | tr '\n' ' ' | xargs node --require ts-node/register --test --test-reporter spec
