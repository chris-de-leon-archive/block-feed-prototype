#!/bin/bash

set -ex

printf "\n\nRunning tests...\n\n"
TEST_FILES=$(
  find . -type f -name '*.tests.ts' |
    tr '\n' ' ' |
    xargs echo
)

# https://github.com/nodejs/help/issues/3902#issuecomment-1307124174
if [ -f ".env" ]; then
  node \
    --env-file=.env \
    --import=tsx \
    --test-concurrency=1 \
    --test-reporter=spec \
    --test $TEST_FILES
else
  node \
    --import=tsx \
    --test-concurrency=1 \
    --test-reporter=spec \
    --test $TEST_FILES
fi
