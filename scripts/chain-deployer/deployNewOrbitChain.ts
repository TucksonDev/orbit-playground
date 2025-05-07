import { createPublicClient, getAddress, http, zeroAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  createRollupPrepareDeploymentParamsConfig,
  prepareChainConfig,
  createRollup,
  prepareNodeConfig,
  PrepareNodeConfigParams,
  setValidKeysetPrepareTransactionRequest,
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
  deepMerge,
  prepareDasConfig,
  saveDasNodeConfigFile,
  chainIsAnytrust,
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
const parentChainRpc = process.env.PARENT_CHAIN_RPC_URL || getRpcUrl(parentChainInformation);
const parentChainPublicClient = createPublicClient({
  chain: parentChainInformation,
  transport: http(parentChainRpc),
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
      DataAvailabilityCommittee: process.env.USE_ANYTRUST == 'true' ? true : false,
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

  // Native token check
  const nativeToken =
    (process.env.NATIVE_TOKEN_ADDRESS && getAddress(process.env.NATIVE_TOKEN_ADDRESS)) ||
    zeroAddress;

  //
  // Rollup contracts deployment
  //
  const transactionResult = await createRollup({
    params: {
      config: orbitChainConfig,
      batchPosters: [batchPoster],
      validators: [validator],
      nativeToken,
      deployFactoriesToL2: process.env.DEPLOY_FACTORIES_TO_L2 == 'true' ? true : false,
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
    parentChainRpcUrl: parentChainRpc,
    parentChainBeaconRpcUrl: chainIsL1(parentChainInformation)
      ? process.env.PARENT_CHAIN_BEACON_RPC_URL
      : undefined,
  };
  let nodeConfig = prepareNodeConfig(nodeConfigParameters);

  if (process.env.DISABLE_L1_FINALITY) {
    const updatedNodeConfig = {
      node: {
        'delayed-sequencer': {
          'require-full-finality': false,
        },
        'batch-poster': {
          'max-delay': '1m',
          'data-poster': {
            'wait-for-l1-finality': false,
          },
        },
        'staker': {
          'make-assertion-interval': '1m',
          'data-poster': {
            'wait-for-l1-finality': false,
          },
        },
        'parent-chain-reader': {
          'use-finality-data': false,
        },
      },
      execution: {
        'parent-chain-reader': {
          'use-finality-data': false,
        },
      },
    };
    nodeConfig = deepMerge(nodeConfig, updatedNodeConfig);
  }

  // Extra customizable options
  if (process.env.NITRO_PORT) {
    nodeConfig.http!.port = Number(process.env.NITRO_PORT);
  }

  const filePath = saveNodeConfigFile(nodeConfig);
  console.log(`Node config written to ${filePath}`);

  // If we want to use AnyTrust, we need to:
  //    1. set the right keyset in the SequencerInbox
  //    2. generate the DAS node configuration
  if (chainIsAnytrust()) {
    //
    // Set the default keyset in the SequencerInbox
    //

    // Default keyset
    const keyset =
      '0x00000000000000010000000000000001012160000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000';

    // Prepare the transaction setting the keyset
    const txRequest = await setValidKeysetPrepareTransactionRequest({
      coreContracts: {
        upgradeExecutor: coreContracts.upgradeExecutor,
        sequencerInbox: coreContracts.sequencerInbox,
      },
      keyset,
      account: chainOwner.address,
      publicClient: parentChainPublicClient,
    });

    // Sign and send the transaction
    const txHash = await parentChainPublicClient.sendRawTransaction({
      serializedTransaction: await chainOwner.signTransaction(txRequest),
    });

    // Wait for the transaction receipt
    const txReceipt = await parentChainPublicClient.waitForTransactionReceipt({ hash: txHash });

    console.log(
      `Keyset updated in ${getBlockExplorerUrl(parentChainInformation)}/tx/${
        txReceipt.transactionHash
      }`,
    );

    //
    // Prepare DAS node config
    //
    const dasNodeConfig = prepareDasConfig(parentChainRpc, coreContracts.sequencerInbox);
    const dasConfigFilePath = saveDasNodeConfigFile(dasNodeConfig);
    console.log(`DAS node config written to ${dasConfigFilePath}`);
  }
};

// Calling main
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
