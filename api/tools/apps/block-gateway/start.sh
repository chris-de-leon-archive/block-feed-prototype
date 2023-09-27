set -e

. ./tools/utils/utils.sh

export NODE_ENV="development"
export APP_ENV="development"

export_env_files "./env/development"
echo ""

nx run-many \
  --configuration development \
  --targets serve \
  --projects block-gateway-consumer,block-gateway-cursor,block-gateway-divider,block-gateway-fetcher
