import { createPublicClient, http, zeroAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  getBlockExplorerUrl,
  getChainConfigFromChainId,
  getRpcUrl,
  sanitizePrivateKey,
  saveTokenBridgeContractsFile,
} from '../../src/utils/helpers';
import {
  chainIsAnytrust,
  getChainNativeToken,
  getChainConfiguration,
  getChainInformation,
} from '../../src/utils/chain-info-helpers';
import 'dotenv/config';
import {
  createTokenBridgeEnoughCustomFeeTokenAllowance,
  createTokenBridgePrepareCustomFeeTokenApprovalTransactionRequest,
  createTokenBridgePrepareSetWethGatewayTransactionReceipt,
  createTokenBridgePrepareSetWethGatewayTransactionRequest,
  createTokenBridgePrepareTransactionReceipt,
  createTokenBridgePrepareTransactionRequest,
} from '@arbitrum/chain-sdk';

// Check for required env variables
if (!process.env.CHAIN_OWNER_PRIVATE_KEY) {
  throw new Error('The following environment variables must be present: CHAIN_OWNER_PRIVATE_KEY');
}

// Load nodeConfig file
const arbitrumChainConfig = getChainConfiguration();

// Load accounts
const chainOwner = privateKeyToAccount(sanitizePrivateKey(process.env.CHAIN_OWNER_PRIVATE_KEY));

// Set the parent chain and create a wallet client for it
const parentChainId = Number(arbitrumChainConfig['parent-chain-id']);
const parentChainInformation = getChainConfigFromChainId(parentChainId);
const parentChainPublicClient = createPublicClient({
  chain: parentChainInformation,
  transport: http(process.env.PARENT_CHAIN_RPC_URL || getRpcUrl(parentChainInformation)),
});

// Set the Arbitrum chain client
const chainInformation = getChainInformation();
const arbitrumChainPublicClient = createPublicClient({
  chain: chainInformation,
  transport: http(),
});

const main = async () => {
  console.log('*************************');
  console.log('* Token bridge deployer *');
  console.log('*************************');
  console.log('');

  // Check for native token
  const nativeToken = (await getChainNativeToken(parentChainPublicClient)) as `0x${string}`;

  if (nativeToken != zeroAddress) {
    // prepare transaction to approve custom fee token spend
    const allowanceParams = {
      nativeToken,
      owner: chainOwner.address,
      publicClient: parentChainPublicClient,
    };
    if (!(await createTokenBridgeEnoughCustomFeeTokenAllowance(allowanceParams))) {
      const approvalTxRequest =
        await createTokenBridgePrepareCustomFeeTokenApprovalTransactionRequest(allowanceParams);

      // sign and send the transaction
      const approvalTxHash = await parentChainPublicClient.sendRawTransaction({
        serializedTransaction: await chainOwner.signTransaction(approvalTxRequest),
      });

      // get the transaction receipt after waiting for the transaction to complete
      const approvalTxReceipt = await parentChainPublicClient.waitForTransactionReceipt({
        hash: approvalTxHash,
      });

      console.log(
        `Tokens approved in ${getBlockExplorerUrl(parentChainInformation)}/tx/${
          approvalTxReceipt.transactionHash
        }`,
      );
    }
  }

  const txRequest = await createTokenBridgePrepareTransactionRequest({
    params: {
      rollup: arbitrumChainConfig.rollup.rollup,
      rollupOwner: chainOwner.address,
    },
    parentChainPublicClient,
    orbitChainPublicClient: arbitrumChainPublicClient,
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
  console.log(`Waiting for retryable tickets to execute on the Arbitrum chain...`);
  const chainRetryableReceipts = await txReceipt.waitForRetryables({
    orbitPublicClient: arbitrumChainPublicClient,
  });
  console.log(`Retryables executed`);
  console.log(
    `Transaction hash for first retryable is ${chainRetryableReceipts[0].transactionHash}`,
  );
  console.log(
    `Transaction hash for second retryable is ${chainRetryableReceipts[1].transactionHash}`,
  );
  if (chainRetryableReceipts[0].status !== 'success') {
    throw new Error(
      `First retryable status is not success: ${chainRetryableReceipts[0].status}. Aborting...`,
    );
  }
  if (chainRetryableReceipts[1].status !== 'success') {
    throw new Error(
      `Second retryable status is not success: ${chainRetryableReceipts[1].status}. Aborting...`,
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
  const arbitrumChainRouterBytecode = await arbitrumChainPublicClient.getBytecode({
    address: tokenBridgeContracts.orbitChainContracts.router,
  });

  if (!arbitrumChainRouterBytecode || arbitrumChainRouterBytecode == '0x') {
    throw new Error(
      `TokenBridge deployment seems to have failed since Arbitrum chain contracts do not have code`,
    );
  }

  if (!chainIsAnytrust()) {
    // set weth gateway
    const setWethGatewayTxRequest = await createTokenBridgePrepareSetWethGatewayTransactionRequest({
      rollup: arbitrumChainConfig.rollup.rollup,
      parentChainPublicClient,
      orbitChainPublicClient: arbitrumChainPublicClient,
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
    const chainSetWethGatewayRetryableReceipt = await setWethGatewayTxReceipt.waitForRetryables({
      orbitPublicClient: arbitrumChainPublicClient,
    });
    console.log(`Retryables executed`);
    console.log(
      `Transaction hash for retryable is ${chainSetWethGatewayRetryableReceipt[0].transactionHash}`,
    );
    if (chainSetWethGatewayRetryableReceipt[0].status !== 'success') {
      throw new Error(
        `Retryable status is not success: ${chainSetWethGatewayRetryableReceipt[0].status}. Aborting...`,
      );
    }
  }
};

// Calling main
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
