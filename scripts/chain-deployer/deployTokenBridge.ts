import { createPublicClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  getBlockExplorerUrl,
  getChainConfigFromChainId,
  getOrbitChainConfiguration,
  getOrbitChainInformation,
  getRpcUrl,
  sanitizePrivateKey,
  saveTokenBridgeContractsFile,
} from '../../src/utils';
import 'dotenv/config';
import {
  createTokenBridgePrepareSetWethGatewayTransactionReceipt,
  createTokenBridgePrepareSetWethGatewayTransactionRequest,
  createTokenBridgePrepareTransactionReceipt,
  createTokenBridgePrepareTransactionRequest,
} from '@arbitrum/orbit-sdk';

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
const parentChainPublicClient = createPublicClient({
  chain: parentChainInformation,
  transport: http(process.env.PARENT_CHAIN_RPC_URL || getRpcUrl(parentChainInformation)),
});

// Set the orbit chain client
const orbitChainInformation = getOrbitChainInformation();
const orbitChainPublicClient = createPublicClient({
  chain: orbitChainInformation,
  transport: http(),
});

const main = async () => {
  console.log('*************************');
  console.log('* Token bridge deployer *');
  console.log('*************************');
  console.log('');

  const txRequest = await createTokenBridgePrepareTransactionRequest({
    params: {
      rollup: orbitChainConfig.rollup.rollup,
      rollupOwner: chainOwner.address,
    },
    parentChainPublicClient,
    orbitChainPublicClient,
    account: chainOwner.address,
    retryableGasOverrides: {
      maxSubmissionCostForFactory: { percentIncrease: 100n },
      maxGasForFactory: { percentIncrease: 100n },
      maxSubmissionCostForContracts: { percentIncrease: 100n },
      maxGasForContracts: { percentIncrease: 100n },
    },
  });

  // sign and send the transaction
  console.log(`Deploying the TokenBridge...`);
  const txHash = await parentChainPublicClient.sendRawTransaction({
    serializedTransaction: await chainOwner.signTransaction(txRequest),
  });

  // get the transaction receipt after waiting for the transaction to complete
  const txReceipt = createTokenBridgePrepareTransactionReceipt(
    await parentChainPublicClient.waitForTransactionReceipt({ hash: txHash }),
  );
  console.log(
    `Deployed in ${getBlockExplorerUrl(parentChainInformation)}/tx/${txReceipt.transactionHash}`,
  );

  // wait for retryables to execute
  console.log(`Waiting for retryable tickets to execute on the Orbit chain...`);
  const orbitChainRetryableReceipts = await txReceipt.waitForRetryables({
    orbitPublicClient: orbitChainPublicClient,
  });
  console.log(`Retryables executed`);
  console.log(
    `Transaction hash for first retryable is ${orbitChainRetryableReceipts[0].transactionHash}`,
  );
  console.log(
    `Transaction hash for second retryable is ${orbitChainRetryableReceipts[1].transactionHash}`,
  );
  if (orbitChainRetryableReceipts[0].status !== 'success') {
    throw new Error(
      `First retryable status is not success: ${orbitChainRetryableReceipts[0].status}. Aborting...`,
    );
  }
  if (orbitChainRetryableReceipts[1].status !== 'success') {
    throw new Error(
      `Second retryable status is not success: ${orbitChainRetryableReceipts[1].status}. Aborting...`,
    );
  }

  // fetching the TokenBridge contracts
  const tokenBridgeContracts = await txReceipt.getTokenBridgeContracts({
    parentChainPublicClient,
  });
  console.log(`TokenBridge contracts:`, tokenBridgeContracts);

  // Save token bridge contracts in JSON file
  const tokenBridgeContractsFilePath = saveTokenBridgeContractsFile(tokenBridgeContracts);
  console.log(`TokenBridge contracts written to ${tokenBridgeContractsFilePath}`);

  // verifying L2 contract existence
  const orbitChainRouterBytecode = await orbitChainPublicClient.getBytecode({
    address: tokenBridgeContracts.orbitChainContracts.router,
  });

  if (!orbitChainRouterBytecode || orbitChainRouterBytecode == '0x') {
    throw new Error(
      `TokenBridge deployment seems to have failed since orbit chain contracts do not have code`,
    );
  }

  // set weth gateway
  const setWethGatewayTxRequest = await createTokenBridgePrepareSetWethGatewayTransactionRequest({
    rollup: orbitChainConfig.rollup.rollup,
    parentChainPublicClient,
    orbitChainPublicClient,
    account: chainOwner.address,
    retryableGasOverrides: {
      gasLimit: {
        percentIncrease: 200n,
      },
    },
  });

  // sign and send the transaction
  const setWethGatewayTxHash = await parentChainPublicClient.sendRawTransaction({
    serializedTransaction: await chainOwner.signTransaction(setWethGatewayTxRequest),
  });

  // get the transaction receipt after waiting for the transaction to complete
  const setWethGatewayTxReceipt = createTokenBridgePrepareSetWethGatewayTransactionReceipt(
    await parentChainPublicClient.waitForTransactionReceipt({ hash: setWethGatewayTxHash }),
  );

  console.log(
    `Weth gateway set in ${getBlockExplorerUrl(parentChainInformation)}/tx/${
      setWethGatewayTxReceipt.transactionHash
    }`,
  );

  // Wait for retryables to execute
  const orbitChainSetWethGatewayRetryableReceipt = await setWethGatewayTxReceipt.waitForRetryables({
    orbitPublicClient: orbitChainPublicClient,
  });
  console.log(`Retryables executed`);
  console.log(
    `Transaction hash for retryable is ${orbitChainSetWethGatewayRetryableReceipt[0].transactionHash}`,
  );
  if (orbitChainSetWethGatewayRetryableReceipt[0].status !== 'success') {
    throw new Error(
      `Retryable status is not success: ${orbitChainSetWethGatewayRetryableReceipt[0].status}. Aborting...`,
    );
  }
};

// Calling main
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
