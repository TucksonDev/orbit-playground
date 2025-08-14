#!/usr/bin/env bash

# Loading .env file
set -o allexport
source .env
set +o allexport

if [ "$ENABLE_BLOCKSCOUT" = "true" ]; then
    docker compose --profile blockscout up
else
    docker compose up
fi