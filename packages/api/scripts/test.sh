#!/bin/bash

set -e

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
find ./tests -type f -name '*.tests.ts' |
	tr '\n' ' ' |
	xargs node \
		--env-file ".env" \
		--require ts-node/register \
		--test \
		--test-concurrency 1 \
		--test-reporter \
		spec
