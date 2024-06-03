#!/bin/bash

set -ex

# Example(s):
#   pnpm test
#   pnpm test refresh

if [ ! -z $1 ]; then
	printf "\n\nGenerating Drizzle schema...\n\n"
	cd "$(git rev-parse --show-toplevel)/packages/drizzle"
	pnpm introspect

	printf "\n\nGenerating GraphQL SDK...\n\n"
	cd "$(git rev-parse --show-toplevel)/packages/gqlgen"
	pnpm codegen
fi

printf "\n\nRunning tests...\n\n"
cd "$(git rev-parse --show-toplevel)/packages/api"
TEST_FILES=$(
	find ./tests -type f -name '*.tests.ts' |
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
