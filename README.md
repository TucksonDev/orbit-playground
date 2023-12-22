# Orbit playground

This repository contains everything that's needed to start playing with Orbit chains: deployment of contracts, customizing and building your nitro node and starting up your chain.

## Setup

1. Clone the repository

    `git clone https://github.com/TucksonDev/orbit-playground.git`

2. Install dependencies

    `yarn install`

    `git submodule update --init --recursive --force`

## Configure your chain

Make a copy of the `.env.example` file and call it `.env`. Then, make sure you set a private key for the Chain owner, Batch poster and Staker accounts. You can leave the rest of options with their default, or customize any of them.

## Deploy an Orbit chain

1. Deploy the contracts

    `yarn run deployChain`

2. Build your nitro node

    `yarn run buildNitro`

3. Launch your nitro node

    `docker compose up`

4. Initialize your chain

    `yarn run initialize`

5. (Optional) Deploy the Token Bridge

    `yarn run deployTokenBridge`

## Update the WASM module root of your node (WIP)

When you modify the State Transition Function (STF) of your node, you have to update the WASM module root on-chain. You can find more information about what this means in the [Arbitrum documentation portal](https://docs.arbitrum.io/launch-orbit-chain/how-tos/customize-stf).

Follow these steps to complete the process.

1. Obtain the new WASM module root

    `yarn run buildNitro`

2. Update the WASM module root

    `yarn run updateWASM <WASM module root>`

## Run your node without Blockscout

To run your node without blockscout, simply specify the appropriate services in the docker compose command:

`docker compose up nitro das-server`
