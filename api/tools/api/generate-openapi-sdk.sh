set -e

OUTPUT_DIR=${1:-".generated/openapi/client"}
FILENAME="$(uuidgen)"

cleanup() {
  if [ -e "$FILENAME.json" ]; then
    rm "$FILENAME.json"
  fi
}

trap cleanup EXIT

rm -rf "$OUTPUT_DIR"

pnpm run api:schema "$FILENAME"

openapi-generator-cli generate \
  -o "$OUTPUT_DIR" \
  -i "$FILENAME.json" \
  -g "typescript-axios"
