#!/usr/bin/env bash

# Loading .env file
# (This small hack preserves existing exported environment variables, usually set in CLI)
set -o allexport
curenv=$(declare -p -x)
source .env
eval "$curenv"
set +o allexport

# Add single-node or split-nodes profile based on $SPLIT_NODES
PROFILES=""
if [ "$SPLIT_NODES" = "true" ]; then
    PROFILES="$PROFILES split-nodes"
else
    PROFILES="$PROFILES single-node"
fi

# Add blockscout profile if enabled
if [ "$ENABLE_BLOCKSCOUT" = "true" ]; then
    PROFILES="$PROFILES blockscout"
fi

# Enable the selected profiles
export COMPOSE_PROFILES="$PROFILES"

# If running in CI, layer docker-compose.ci.yaml on top
COMPOSE_FILES=()
if [ "$CI_RUN" = "true" ]; then
    echo "CI_RUN=true detected: using docker-compose.ci.yaml overlay"
    COMPOSE_FILES=(-f docker-compose.yaml -f docker-compose.ci.yaml)
else
    COMPOSE_FILES=()
fi

# Obtain the list of services to be started
mapfile -t SERVICES < <(docker compose config --services)
echo "Services: ${SERVICES[*]}"

# Create containers without starting them
docker compose "${COMPOSE_FILES[@]}" create "${SERVICES[@]}"

# Connect containers to the testnet docker network if needed
if [ -n "$DOCKER_NETWORK" ]; then
    for svc in "${SERVICES[@]}"; do
        echo "Connecting service $svc to network $DOCKER_NETWORK"
        cid=$(docker compose "${COMPOSE_FILES[@]}" ps -a -q "$svc")
        [ -z "$cid" ] && continue
        docker network connect "$DOCKER_NETWORK" "$cid" 2>/dev/null || true
        echo "Service connected"
    done
fi

# Start all services
docker compose "${COMPOSE_FILES[@]}" start "${SERVICES[@]}"

echo "Nitro services started with profiles: $COMPOSE_PROFILES"