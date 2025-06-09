#!/usr/bin/env bash

set -eo pipefail

if [[ -z "${BWS_PROJECT_ID:-}" ]]; then
  echo "error: environment variable 'BWS_PROJECT_ID' must be defined"
  exit 1
fi

declare -A SECRET_TO_PATH
SECRET_TO_PATH["DEV_FRONTEND"]="./apps/web/.env"
SECRET_TO_PATH["DEV_BACKEND"]="./apps/dashboard/.env"

CACHE=""
for SECRET_KEY in "${!SECRET_TO_PATH[@]}"; do
  SECRET_VAL="$(cat "${SECRET_TO_PATH[${SECRET_KEY}]}")"

  if [[ -z "${!SECRET_KEY}" ]]; then
    bws secret create "${SECRET_KEY}" "${SECRET_VAL}" "${BWS_PROJECT_ID}"
    continue
  fi

  if [[ -z "${CACHE}" ]]; then
    CACHE="$(bws secret list "${BWS_PROJECT_ID}")"
  fi

  SECRET_ID="$(echo "${CACHE}" | jq -erc --arg k "${SECRET_KEY}" 'first(.[] | select(.key == $k)).id')"
  bws secret edit --value "${SECRET_VAL}" --project-id "${BWS_PROJECT_ID}" "${SECRET_ID}"
done
