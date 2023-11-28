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
docker build . --tag $NITRO_DOCKER_IMAGE_TAG

# Going back to root
cd ..

# Confirmation
echo "Nitro docker image has been created with tag $NITRO_DOCKER_IMAGE_TAG"