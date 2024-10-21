#!/bin/bash

set -e

NIXPKGS_ALLOW_UNFREE=1 \
  nix \
  --extra-experimental-features 'flakes' \
  --extra-experimental-features 'nix-command' \
  develop \
  --show-trace \
  --impure \
  "./nix"
