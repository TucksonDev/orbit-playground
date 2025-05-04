import { createPublicClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  createRollupPrepareDeploymentParamsConfig,
  prepareChainConfig,
  createRollup,
  prepareNodeConfig,
  PrepareNodeConfigParams,
} from '@arbitrum/orbit-sdk';
import { generateChainId } from '@arbitrum/orbit-sdk/utils';
import {
  getBlockExplorerUrl,
  getChainConfigFromChainId,
  sanitizePrivateKey,
  withFallbackPrivateKey,
  getRpcUrl,
  saveNodeConfigFile,
  chainIsL1,
  saveCoreContractsFile,
} from '../../src/utils';
import 'dotenv/config';

// Check for required env variables
if (
  !process.env.PARENT_CHAIN_ID ||
  !process.env.CHAIN_OWNER_PRIVATE_KEY ||
  !process.env.BATCH_POSTER_PRIVATE_KEY ||
  !process.env.STAKER_PRIVATE_KEY ||
  !process.env.CHAIN_CONFIG_FOLDER ||
  !process.env.NODE_CONFIG_FILENAME
) {
  throw new Error(
    'The following environment variables must be present: PARENT_CHAIN_ID, CHAIN_OWNER_PRIVATE_KEY, BATC_POSTER_PRIVATE_KEY, STAKER_PRIVATE_KEY, CHAIN_CONFIG_FOLDER, NODE_CONFIG_FILENAME',
  );
}

// Load or generate a random batch poster account
const batchPosterPrivateKey = withFallbackPrivateKey(process.env.BATCH_POSTER_PRIVATE_KEY);
const batchPoster = privateKeyToAccount(batchPosterPrivateKey).address;

// Load or generate a random staker account
const validatorPrivateKey = withFallbackPrivateKey(process.env.STAKER_PRIVATE_KEY);
const validator = privateKeyToAccount(validatorPrivateKey).address;

// Set the parent chain and create a public client for it
const parentChainInformation = getChainConfigFromChainId(Number(process.env.PARENT_CHAIN_ID));
const parentChainPublicClient = createPublicClient({
  chain: parentChainInformation,
  transport: http(process.env.PARENT_CHAIN_RPC_URL || getRpcUrl(parentChainInformation)),
});

// Load the deployer account
const chainOwner = privateKeyToAccount(sanitizePrivateKey(process.env.CHAIN_OWNER_PRIVATE_KEY));

const main = async () => {
  console.log('***********************');
  console.log('* Orbit chain creator *');
  console.log('***********************');
  console.log('');

  // Generate a random chain id
  const orbitChainId = generateChainId();

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
  const orbitChainConfig = createRollupPrepareDeploymentParamsConfig(parentChainPublicClient, {
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
  const transactionResult = await createRollup({
    params: {
      config: orbitChainConfig,
      batchPosters: [batchPoster],
      validators: [validator],
    },
    account: chainOwner,
    parentChainPublicClient,
  });

  console.log(
    `Orbit chain was successfully deployed. Transaction hash: ${getBlockExplorerUrl(
      parentChainInformation,
    )}/tx/${transactionResult.transactionReceipt.transactionHash}`,
  );

  // Get the core contracts from the transaction receipt
  const coreContracts = transactionResult.transactionReceipt.getCoreContracts();

  // Save core contracts in JSON file
  const coreContractsFilePath = saveCoreContractsFile(coreContracts);
  console.log(`Core contracts written to ${coreContractsFilePath}`);

  //
  // Preparing the node configuration
  //
  const nodeConfigParameters: PrepareNodeConfigParams = {
    chainName: process.env.ORBIT_CHAIN_NAME || 'My Orbit chain',
    chainConfig,
    coreContracts,
    batchPosterPrivateKey: batchPosterPrivateKey,
    validatorPrivateKey: validatorPrivateKey,
    parentChainId: parentChainInformation.id,
    parentChainRpcUrl: process.env.PARENT_CHAIN_RPC_URL || getRpcUrl(parentChainInformation),
    parentChainBeaconRpcUrl: chainIsL1(parentChainInformation)
      ? process.env.PARENT_CHAIN_BEACON_RPC_URL
      : undefined,
  };
  const nodeConfig = prepareNodeConfig(nodeConfigParameters);

  if (process.env.DISABLE_L1_FINALITY) {
    nodeConfig.node!['delayed-sequencer']!['require-full-finality'] = false;
    nodeConfig.node!['batch-poster']!['max-delay'] = '5m';
    nodeConfig.node!['batch-poster']!['data-poster'] = {
      'wait-for-l1-finality': false,
    };
    nodeConfig.node!['staker']!['make-assertion-interval'] = '5m';
    nodeConfig.node!['staker']!['data-poster'] = {
      'wait-for-l1-finality': false,
    };
    nodeConfig.node!['parent-chain-reader'] = {
      'use-finality-data': false,
    };
    nodeConfig.execution!['parent-chain-reader'] = {
      'use-finality-data': false,
    };
  }

  // Extra customizable options
  if (process.env.NITRO_PORT) {
    nodeConfig.http!.port = Number(process.env.NITRO_PORT);
  }

  const filePath = saveNodeConfigFile(nodeConfig);
  console.log(`Node config written to ${filePath}`);
};

// Calling main
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
