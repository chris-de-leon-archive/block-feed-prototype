set -e

. ./tools/utils/utils.sh

export_env_files "./env/dev"
echo ""

DB_ENABLE_LOGGING=true nx run-many \
  --configuration development \
  --targets serve \
  --projects block-gateway-consumer,block-gateway-divider,block-gateway-fetcher-flow,block-gateway-logger,block-gateway-mailer,block-gateway-webhook
