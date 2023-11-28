# Orbit playground

This repository contains everything that's needed to start playing with Orbit chains: deployment of contracts, customizing and building your nitro node and starting up your chain.

## Setup

1. Clone the repository

    `git clone ...`

2. Install dependencies

    `yarn install`

    `git submodule update --init --recursive --force`

## Configure your chain

Make a copy of the `.env.example` file and call it `.env`. Then, make sure you set a private key for the Chain owner, Batch poster and Staker accounts. You can leave the rest of options with their default, or personalize any of them.

## Deploy an Orbit chain

1. Deploy the contracts

    `yarn run deployOrbitChain`

2. Build your nitro node

    `yarn run buildNitro`

3. Launch your nitro node

    `docker compose up`

## TODO
- Add the initialization script (copy and adapt from orbit-setup-script)
- Add support for AnyTrust chains
- Allow running a chain without blockscout
- Test with multiple Orbit chains
