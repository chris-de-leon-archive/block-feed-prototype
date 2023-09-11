set -e

. ./tools/utils/tools.sh

OUTPUT_DIR=${1:-".generated/openapi/client"}

rm -rf $OUTPUT_DIR

npm run openapi:gen:docs

openapi \
  -o /workspace/"$OUTPUT_DIR" \
  -i /workspace/docs.json \
  -g typescript-axios

if [ -e "docs.json" ]; then
  rm "docs.json"
fi
