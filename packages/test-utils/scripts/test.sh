#!/bin/bash

set -ex

# Example(s):
#   pnpm test
#   pnpm test refresh

if [ ! -z $1 ]; then
	printf "\n\nGenerating Drizzle schema...\n\n"
	pnpm --filter=@block-feed/drizzle introspect

	printf "\n\nGenerating GraphQL SDK...\n\n"
	pnpm --filter=@block-feed/gqlgen codegen
fi

printf "\n\nRunning tests...\n\n"
TEST_FILES=$(
	find . -type f -name '*.tests.ts' |
		tr '\n' ' ' |
		xargs echo
)

# https://github.com/nodejs/help/issues/3902#issuecomment-1307124174
node \
	--env-file=.env \
	--import=tsx \
	--test-concurrency=1 \
	--test-reporter=spec \
	--test $TEST_FILES
