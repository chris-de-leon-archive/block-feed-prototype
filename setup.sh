#!/bin/bash

set -e

if [ "$1" = "dev" ]; then
  NIXPKGS_ALLOW_UNFREE=1 \
    nix \
    --extra-experimental-features 'flakes' \
    --extra-experimental-features 'nix-command' \
    develop \
    --show-trace \
    --impure \
    ./nix#dev
else
  NIXPKGS_ALLOW_UNFREE=1 \
    nix \
    --extra-experimental-features 'flakes' \
    --extra-experimental-features 'nix-command' \
    develop \
    --show-trace \
    --impure \
    ./nix
fi
