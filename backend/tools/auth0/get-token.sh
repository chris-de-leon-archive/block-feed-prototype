set -e

. ./tools/utils/utils.sh

export_env_files "./env/development"
echo ""

ts-node ./tools/auth0/get-token.ts
