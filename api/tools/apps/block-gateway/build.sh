set -e

# $1 = development or production
ENV="${1:-development}"

export NODE_ENV="$ENV"

nx run-many \
  --configuration "$ENV" \
  --targets build \
  --projects block-gateway-consumer,block-gateway-divider,block-gateway-fetcher-flow,block-gateway-logger
