set -e

OUTPUT_DIR=${1:-".generated/openapi/client"}

rm -rf $OUTPUT_DIR

npm run openapi:gen:docs

openapi-generator-cli generate \
  -o "$OUTPUT_DIR" \
  -i "docs.json" \
  -g "typescript-axios"

if [ -e "docs.json" ]; then
  rm "docs.json"
fi
