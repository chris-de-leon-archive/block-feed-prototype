set -e

. ./tools/utils/utils.sh

# Gets the API ID
REST_API_ID=$(awslocal apigateway get-rest-apis --query 'items[0].id' --output text)

# Removes newlines and strange escape sequences
REST_API_ID=$(clean_str "$REST_API_ID")

# Defines helper variables
REST_API_URL="https://$REST_API_ID.execute-api.localhost.localstack.cloud:4566/development"
TEST_ENV_FILE=./env/dev/test.env

# Uses sed to replace TEST_API_URL
sed -i "s|TEST_API_URL=.*|TEST_API_URL=$REST_API_URL|" "$TEST_ENV_FILE"

# Prints the API URL
printf "API URL: $REST_API_URL\n\n"
