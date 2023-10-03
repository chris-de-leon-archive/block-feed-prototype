set -e

. ./tools/utils/tools.sh
. ./tools/utils/utils.sh

# Gets the API ID
REST_API_ID=$(awslocal apigateway get-rest-apis --query 'items[0].id' --output text)

# Removes newlines and strange escape sequences
REST_API_ID=$(clean_str "$REST_API_ID")

# Writes the API URL to an env file
REST_API_URL="https://$REST_API_ID.execute-api.localhost.localstack.cloud:4566/development"
TEST_ENV_FILE=./env/dev/test.env
echo "TEST_LOCALSTACK_URL=$REST_API_URL" >$TEST_ENV_FILE
printf "API URL: $REST_API_URL\n\n"
