#!/bin/bash

# Loading .env file
set -o allexport
source .env
set +o allexport

# Clean Orbit chain files
find chainConfig -mindepth 1 ! -name '.gitignore' ! -name 'batch-poster' ! -name 'staker' ! -name 'rpc' ! -name 'das-server' ! -name 'keys' ! -name 'das_bls*' -delete
find chainDasData -mindepth 1 ! -name '.gitignore' -delete

# Clean Docker containers (Blockscout)
if [ "$ENABLE_BLOCKSCOUT" = "true" ]; then
    docker compose run --rm redis-db-clean
    docker compose run --rm db-clean
    docker compose run --rm backend-clean
    docker compose run --rm stats-db-clean
fi
