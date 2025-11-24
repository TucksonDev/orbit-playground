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

Additionally, if the parent chain is not supported in the Orbit SDK, set the following env variables:

```shell
ROLLUPCREATOR_FACTORY_ADDRESS=
WETH_ADDRESS=
# CHAIN_MAX_DATA_SIZE should be 104857 for L3s and 117964 for L2s
CHAIN_MAX_DATA_SIZE=
```

## Deploy an Orbit chain

1. Deploy the contracts

    `yarn deploy-chain`

2. Launch your nitro node

    `yarn start-node`

3. Initialize your chain

    `yarn initialize-chain`

4. (Optional) Deploy the Token Bridge

    `yarn deploy-token-bridge`

5. (Optional) Transfer ownership of the chain to the UpgradeExecutor

    `yarn transfer-ownership`

## Structure of docker containers

When starting your nodes with `yarn start-node`, up to four containers will start:

- `batch-poster`: the sequencer/batch-poster for your chain
- `staker`: the validator/staker for your chain
- `rpc`: a regular RPC node for your chain
- `das-server`: a Data Availability Server if you're running an AnyTrust chain

You can manage each individual container with the following commands:

- `docker compose stop <container>`: stops the specified container
- `docker compose start <container>`: starts the specified container
- `docker compose restart <container>`: restarts the specified container
- `docker compose create <container>`: creates the specified container (in case it's been removed)

## Enable Blockscout

Setting the env variable `ENABLE_BLOCKSCOUT` to true, will start the blockscout containers when running `start-node`.

Blockscout will be available at http://localhost/

## Clean up data

To clean up all data generated while running the chain, you can run the following command

`yarn clean`

## Deploy the RollupCreator factory

Make sure the submodules are up to date

```shell
git submodule update --init --force --recursive
```

Build the nitro-contracts submodule

```shell
yarn build-nitro-contracts
```

Modify the following env variable:

```shell
# MAX_DATA_SIZE should be 104857 for L3s and 117964 for L2s
MAX_DATA_SIZE=
```

Run the rollup creator deployer script with:

```shell
yarn deploy-rollup-creator
```

## Deploy the TokenBridgeCreator factory

Make sure the submodules are up to date

```shell
git submodule update --init --force --recursive
```

Build the token-bridge-contracts submodule

```shell
yarn build-token-bridge-contracts
```

Modify the following env variable:

```shell
# BASECHAIN_WETH should be set to the WETH address of the parent chain
BASECHAIN_WETH=
```

Run the rollup creator deployer script with:

```shell
yarn deploy-token-bridge-creator
```

## Building nitro

This repository contains the nitro project as a submodule, to be able to easily make custom changes to the nitro codebase and then compile a local nitro image to run your nodes. Keep in mind that the changes made to the nitro codebase shouldn't affect the State Transition Function (STF), otherwise you'd need to obtain a new WasmModuleRoot for your chain (more information can be found [here](https://docs.arbitrum.io/launch-arbitrum-chain/customize-your-chain/customize-stf)).

To build a custom nitro image, follow these instructions:

1. Make any changes that you wish to make in the submodule
2. Set the `NITRO_DOCKER_IMAGE_TAG` env variable to the tag you want to use to build your image
3. Build the nitro image from the root of this project

    ```shell
    yarn run build-nitro
    ```

### Issues when switching the branch on the nitro folder

You might run into issues when switching the nitro submodule to a branch with significant changes in its own submodules. To avoid these issues, you can use the following procedure:

1. Update the submodule to the remote version:

    ```shell
    git submodule update --remote nitro
    git submodule update --init --force --recursive nitro
    ```

2. Access the nitro folder and checkout (with submodules) the version that you wish to have (in this case `master`)

    ```shell
    git checkout --recurse-submodules master
    ```

3. Pull any pending changes

    ```shell
    git pull
    ```

4. Update the nitro submodules again

    ```shell
    git submodule update --remote
    git submodule update --init --force --recursive
    ```

## Update the WASM module root of your node (WIP)

When you modify the State Transition Function (STF) of your node, you have to update the WASM module root on-chain. You can find more information about what this means in the [Arbitrum documentation portal](https://docs.arbitrum.io/launch-orbit-chain/how-tos/customize-stf).

Follow these steps to complete the process.

1. Obtain the new WASM module root

    `yarn run buildNitro`

2. Update the WASM module root

    `yarn run updateWASM <WASM module root>`
