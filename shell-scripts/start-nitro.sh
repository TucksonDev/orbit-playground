#!/usr/bin/env bash

# Loading .env file
set -o allexport
source .env
set +o allexport

# Add single-node or split-nodes profile based on $SPLIT_NODES
PROFILES=""
if [ "$SPLIT_NODES" = "true" ]; then
    PROFILES="$PROFILES --profile split-nodes"
else
    PROFILES="$PROFILES --profile single-node"
fi

# Add blockscout profile if enabled
if [ "$ENABLE_BLOCKSCOUT" = "true" ]; then
    PROFILES="$PROFILES --profile blockscout"
fi

docker compose $PROFILES up
