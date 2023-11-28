import { createPublicClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  createRollupPrepareConfig,
  prepareChainConfig,
  createRollupPrepareTransactionRequest,
  createRollupPrepareTransactionReceipt,
  prepareNodeConfig,
} from '@arbitrum/orbit-sdk';
import { generateChainId } from '@arbitrum/orbit-sdk/utils';
import {
  getBlockExplorerUrl,
  getChainConfigFromChainId,
  sanitizePrivateKey,
  withFallbackPrivateKey,
  getRpcUrl,
} from '../src/utils';
import { writeFileSync } from 'fs';
import 'dotenv/config';

// Check for required env variables
if (
  !process.env.BASE_CHAIN_ID ||
  !process.env.CHAIN_OWNER_PRIVATE_KEY ||
  !process.env.BATCH_POSTER_PRIVATE_KEY ||
  !process.env.STAKER_PRIVATE_KEY ||
  !process.env.CHAIN_CONFIG_FOLDER ||
  !process.env.NODE_CONFIG_FILENAME
) {
  throw new Error(
    'The following environment variables must be present: BASE_CHAIN_ID, CHAIN_OWNER_PRIVATE_KEY, BATC_POSTER_PRIVATE_KEY, STAKER_PRIVATE_KEY, CHAIN_CONFIG_FOLDER, NODE_CONFIG_FILENAME',
  );
}

// Load or generate a random batch poster account
const batchPosterPrivateKey = withFallbackPrivateKey(process.env.BATCH_POSTER_PRIVATE_KEY);
const batchPoster = privateKeyToAccount(batchPosterPrivateKey).address;

// Load or generate a random staker account
const validatorPrivateKey = withFallbackPrivateKey(process.env.STAKER_PRIVATE_KEY);
const validator = privateKeyToAccount(validatorPrivateKey).address;

// Set the parent chain and create a public client for it
const chainInformation = getChainConfigFromChainId(Number(process.env.BASE_CHAIN_ID));
const parentChainPublicClient = createPublicClient({
  chain: chainInformation,
  transport: http(),
});

// Load the deployer account
const chainOwner = privateKeyToAccount(sanitizePrivateKey(process.env.CHAIN_OWNER_PRIVATE_KEY));

const main = async () => {
  console.log('***********************');
  console.log('* Orbit chain creator *');
  console.log('***********************');
  console.log('');

  // Generate a random chain id
  const orbitChainId = process.env.ORBIT_CHAIN_ID
    ? Number(process.env.ORBIT_CHAIN_ID)
    : generateChainId();

  //
  // Create the chain config
  //
  const chainConfig = prepareChainConfig({
    chainId: orbitChainId,
    arbitrum: {
      InitialChainOwner: chainOwner.address,
    },
  });

  // Prepare the transaction for deploying the core contracts
  const orbitChainConfig = createRollupPrepareConfig({
    chainConfig,
    chainId: BigInt(orbitChainId),
    owner: chainOwner.address,
  });

  // Extra parametrization
  orbitChainConfig.confirmPeriodBlocks = BigInt(20);

  console.log(`Chain configuration is:`);
  console.log(orbitChainConfig);

  //
  // Rollup contracts deployment
  //
  const request = await createRollupPrepareTransactionRequest({
    params: {
      config: orbitChainConfig,
      batchPoster,
      validators: [validator],
      // deployFactoriesToL2: true,
    },
    account: chainOwner.address,
    publicClient: parentChainPublicClient,
  });

  // Sign and send the transaction
  const txHash = await parentChainPublicClient.sendRawTransaction({
    serializedTransaction: await chainOwner.signTransaction(request),
  });

  // Get the transaction receipt after waiting for the transaction to complete
  const txReceipt = createRollupPrepareTransactionReceipt(
    await parentChainPublicClient.waitForTransactionReceipt({ hash: txHash }),
  );

  console.log(
    `Orbit chain was successfully deployed. Transaction hash: ${getBlockExplorerUrl(
      chainInformation,
    )}/tx/${txReceipt.transactionHash}`,
  );

  //
  // Preparing the node configuration
  //
  // Get the core contracts from the transaction receipt
  const coreContracts = txReceipt.getCoreContracts();

  // prepare the node config
  const nodeConfig = prepareNodeConfig({
    chainName: process.env.ORBIT_CHAIN_NAME || 'My Orbit chain',
    chainConfig,
    coreContracts,
    batchPosterPrivateKey: batchPosterPrivateKey,
    validatorPrivateKey: validatorPrivateKey,
    parentChainId: chainInformation.id,
    parentChainRpcUrl: getRpcUrl(chainInformation),
  });

  const configDir = process.env.CHAIN_CONFIG_FOLDER || 'chainConfig';
  const nodeConfigFilename = (process.env.NODE_CONFIG_FILENAME || 'node-config') + '.json';
  const filePath = configDir + '/' + nodeConfigFilename;
  writeFileSync(filePath, JSON.stringify(nodeConfig, null, 2));
  console.log(`Node config written to ${filePath}`);
};

// Calling main
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
