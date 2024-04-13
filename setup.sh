#!/bin/bash

set -e

NIXPKGS_ALLOW_UNFREE=1 nix develop --impure ./nix
