#!/usr/bin/env bash

###############
## Before executing this file make sure that:
##  1. You have docker installed ( Find instructions here: https://docs.arbitrum.io/node-running/how-tos/build-nitro-locally#step-1-configure-docker )
##  2. Your nitro submodule is up to date (you can run `git submodule update --init --recursive --force` to be sure)
###############

# Loading .env file
set -o allexport
source .env
set +o allexport

# Check for NITRO_DOCKER_IMAGE_TAG environment variable
if [[ -z "${NITRO_DOCKER_IMAGE_TAG}" ]]; then
  echo "Please set NITRO_DOCKER_IMAGE_TAG in the .env file"
  exit
fi

# Entering nitro folder
cd nitro

# Building docker
docker build . --target nitro-node-dev --tag $NITRO_DOCKER_IMAGE_TAG

# Getting the WASM module root
WASM_MODULE_ROOT="$(docker run --rm --entrypoint cat $NITRO_DOCKER_IMAGE_TAG target/machines/latest/module-root.txt)"

# Going back to root
cd ..

# Confirmation
echo "Nitro docker image (with target node-dev) has been created with tag $NITRO_DOCKER_IMAGE_TAG"
echo "Current WASM module root is $WASM_MODULE_ROOT"