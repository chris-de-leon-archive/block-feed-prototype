set -e

. ./tools/utils/utils.sh

export_env_files "./env/development"

npx serverless offline
