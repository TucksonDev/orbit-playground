import { createPublicClient, createWalletClient, http, parseAbi, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  getBlockExplorerUrl,
  getChainConfigFromChainId,
  getOrbitChainConfiguration,
  sanitizePrivateKey,
} from '../../src/utils';
import 'dotenv/config';
import { orbitDeploymentContracts } from '../../src/contracts';

// Check for required env variables
if (!process.env.CHAIN_OWNER_PRIVATE_KEY) {
  throw new Error('The following environment variables must be present: CHAIN_OWNER_PRIVATE_KEY');
}

// Load nodeConfig file
const orbitChainConfig = getOrbitChainConfiguration();

// Load accounts
const chainOwner = privateKeyToAccount(sanitizePrivateKey(process.env.CHAIN_OWNER_PRIVATE_KEY));

// Set the parent chain and create a wallet client for it
const parentChainId = Number(orbitChainConfig['parent-chain-id']);
const parentChainInformation = getChainConfigFromChainId(parentChainId);
const parentChainWalletClient = createWalletClient({
  account: chainOwner,
  chain: parentChainInformation,
  transport: http(),
});
const parentChainPublicClient = createPublicClient({
  chain: parentChainInformation,
  transport: http(),
});

// Contract constants
const inboxAddress = orbitChainConfig.rollup.inbox;

const main = async () => {
  console.log('*************************');
  console.log('* Token bridge deployer *');
  console.log('*************************');
  console.log('');

  // Because this will later be handled by the Orbit SDK (probably),
  // we just hardcode the gas limit and callvalue here.
  const maxGasForContracts = 31_000_000n;
  const deploymentCallvalue = parseEther('0.005');

  //
  // Deploying the token bridge
  //
  console.log(`Deploy Token Bridge on parent chain...`);
  const tokenBridgeCreatorAddress = orbitDeploymentContracts[parentChainId].tokenBridgeCreator;
  const currentGasPrice = await parentChainPublicClient.getGasPrice();
  const { request } = await parentChainPublicClient.simulateContract({
    account: chainOwner,
    address: tokenBridgeCreatorAddress,
    abi: parseAbi(['function createTokenBridge(address,address,uint256,uint256) external payable']),
    functionName: 'createTokenBridge',
    args: [inboxAddress, chainOwner.address, maxGasForContracts, currentGasPrice],
    value: deploymentCallvalue,
  });
  const tokenBridgeDeploymentTxHash = await parentChainWalletClient.writeContract(request);
  console.log(
    `Done! Transaction hash on parent chain: ${getBlockExplorerUrl(
      parentChainInformation,
    )}/tx/${tokenBridgeDeploymentTxHash}`,
  );

  // Same here. This will probably be handled by the Orbit SDK later, so we just exit with a message.
  console.log(
    `Token Bridge retryable transactions has been sent to the Orbit chain. It is recommended to wait a few minutes until they are executed.`,
  );
};

// Calling main
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
