import { createPublicClient, getAddress, http, parseEther, zeroAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  createRollupPrepareDeploymentParamsConfig,
  prepareChainConfig,
  createRollup,
  setValidKeysetPrepareTransactionRequest,
} from '@arbitrum/orbit-sdk';
import { generateChainId } from '@arbitrum/orbit-sdk/utils';
import {
  prepareDasConfig,
  buildNodeConfiguration,
  saveDasNodeConfigFile,
} from '../../src/utils/node-configuration';
import {
  getBlockExplorerUrl,
  getChainConfigFromChainId,
  sanitizePrivateKey,
  withFallbackPrivateKey,
  getRpcUrl,
  saveCoreContractsFile,
  isParentChainSupported,
} from '../../src/utils/helpers';
import { chainIsAnytrust } from '../../src/utils/chain-info-helpers';
import 'dotenv/config';

// Check for required env variables
if (
  !process.env.PARENT_CHAIN_ID ||
  !process.env.CHAIN_OWNER_PRIVATE_KEY ||
  !process.env.BATCH_POSTER_PRIVATE_KEY ||
  !process.env.STAKER_PRIVATE_KEY
) {
  throw new Error(
    'The following environment variables must be present: PARENT_CHAIN_ID, CHAIN_OWNER_PRIVATE_KEY, BATC_POSTER_PRIVATE_KEY, STAKER_PRIVATE_KEY',
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
const parentChainIsSupported = isParentChainSupported(parentChainInformation.id);
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

    // Extra parametrization
    confirmPeriodBlocks: 20n, // Reduce confirm period blocks
    baseStake: parseEther('0.1'), // Reduce base stake for proving

    // The following parameters are mandatory for non-supported parent chains
    challengeGracePeriodBlocks: parentChainIsSupported ? undefined : 20n,
    minimumAssertionPeriod: parentChainIsSupported ? undefined : 75n,
    validatorAfkBlocks: parentChainIsSupported ? undefined : 201600n,
    sequencerInboxMaxTimeVariation: parentChainIsSupported
      ? undefined
      : {
          delayBlocks: 28800n,
          delaySeconds: 345600n,
          futureBlocks: 300n,
          futureSeconds: 3600n,
        },
  });

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

      // The following parameters are mandatory for non-supported parent chains
      maxDataSize: parentChainIsSupported ? undefined : BigInt(process.env.CHAIN_MAX_DATA_SIZE!),
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

  // Build node configuration
  const { batchPosterfilePath, stakerFilePath, rpcFilePath } = buildNodeConfiguration(
    chainConfig,
    coreContracts,
    batchPosterPrivateKey,
    validatorPrivateKey,
    orbitChainConfig.stakeToken,
    parentChainInformation,
    parentChainRpc,
  );
  console.log(`Batch poster config written to ${batchPosterfilePath}`);
  console.log(`Staker config written to ${stakerFilePath}`);
  console.log(`RPC config written to ${rpcFilePath}`);

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
