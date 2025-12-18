#!/bin/bash

# Loading .env file
# (This small hack preserves existing exported environment variables, usually set in CLI)
set -o allexport
curenv=$(declare -p -x)
source .env
eval "$curenv"
set +o allexport

# Check whether the required environment variables are set
if [[ -z "${BASECHAIN_RPC}" || -z "${BASECHAIN_DEPLOYER_KEY}" || -z "${BASECHAIN_WETH}" || -z "${GAS_LIMIT_FOR_L2_FACTORY_DEPLOYMENT}" ]]; then
    echo "Please make sure the following environment variables are set in the .env file:"
    echo "BASECHAIN_RPC, BASECHAIN_DEPLOYER_KEY, BASECHAIN_WETH, GAS_LIMIT_FOR_L2_FACTORY_DEPLOYMENT"
    exit 1
fi

# Check whether the CREATE2 proxy is already deployed
CREATE2_PROXY_ADDRESS=0x4e59b44847b379578588920cA78FbF26c0B4956C
CREATE2_PROXY_DEPLOYER_ADDRESS=0x3fab184622dc19b6109349b94811493bf2a45362
CREATE2_PROXY_DEPLOYMENT_TRANSACTION=0xf8a58085174876e800830186a08080b853604580600e600039806000f350fe7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe03601600081602082378035828234f58015156039578182fd5b8082525050506014600cf31ba02222222222222222222222222222222222222222222222222222222222222222a02222222222222222222222222222222222222222222222222222222222222222

CREATE2_PROXY_CODE=$(cast code -r $CUSTOM_RPC_URL $CREATE2_PROXY_ADDRESS)
if ([ "$CREATE2_PROXY_CODE" = "0x" ] || [ "$CREATE2_PROXY_CODE" = "0x0" ]); then
    echo "CREATE2 proxy is not deployed at address $CREATE2_PROXY_ADDRESS"

    # We add an extra env variable check, to avoid accidental deployments
    if [ -z "${CREATE2_PROXY_DEPLOYMENT}" ]; then
        echo "Set the CREATE2_PROXY_DEPLOYMENT environment variable to deploy the CREATE2 proxy."
        exit 1
    fi

    # Fund the CREATE2 proxy deployer address
    echo "Deploying CREATE2 proxy..."
    cast send --private-key $CUSTOM_PRIVKEY -r $CUSTOM_RPC_URL --value 0.1ether $CREATE2_PROXY_DEPLOYER_ADDRESS

    # Deploy the CREATE2 proxy
    cast publish -r $CUSTOM_RPC_URL $CREATE2_PROXY_DEPLOYMENT_TRANSACTION
fi

# Call the deploy-factory script with the provided environment variables
dotenv -- yarn --cwd token-bridge-contracts deploy:token-bridge-creator
