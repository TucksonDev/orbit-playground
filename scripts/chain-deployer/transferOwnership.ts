import { createPublicClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbOwnerPublicActions } from '@arbitrum/chain-sdk';
import {
  getBlockExplorerUrl,
  sanitizePrivateKey,
  readTokenBridgeContractsFile,
} from '../../src/utils/helpers';
import { getChainInformation } from '../../src/utils/chain-info-helpers';
import 'dotenv/config';

// Check for required env variables
if (!process.env.CHAIN_OWNER_PRIVATE_KEY) {
  throw new Error('The following environment variables must be present: CHAIN_OWNER_PRIVATE_KEY');
}

// Load accounts
const chainOwner = privateKeyToAccount(sanitizePrivateKey(process.env.CHAIN_OWNER_PRIVATE_KEY));

// Set the Arbitrum chain and create a public client for it
const chainInformation = getChainInformation();
const arbitrumChainPublicClient = createPublicClient({
  chain: chainInformation,
  transport: http(),
}).extend(arbOwnerPublicActions);

const main = async () => {
  console.log('**********************************************************');
  console.log('* Arbitrum chain - Transfer ownership to UpgradeExecutor *');
  console.log('**********************************************************');
  console.log('');

  //
  // Getting the core contracts
  //
  const tokenBridgeContracts = readTokenBridgeContractsFile();

  //
  // Transfering the ownership of the chain
  //
  console.log(
    `Transfer ownership to the UpgradeExecutor (${tokenBridgeContracts.orbitChainContracts.upgradeExecutor})...`,
  );
  const addOwnerUpgradeExecutorRequest =
    await arbitrumChainPublicClient.arbOwnerPrepareTransactionRequest({
      functionName: 'addChainOwner',
      args: [tokenBridgeContracts.orbitChainContracts.upgradeExecutor],
      upgradeExecutor: false,
      account: chainOwner.address,
    });
  const addOwnerUpgradeExecutorTxHash = await arbitrumChainPublicClient.sendRawTransaction({
    serializedTransaction: await chainOwner.signTransaction(addOwnerUpgradeExecutorRequest),
  });
  console.log(
    `Done! Transaction hash on arbitrum chain: ${getBlockExplorerUrl(
      chainInformation,
    )}/tx/${addOwnerUpgradeExecutorTxHash}`,
  );

  console.log(`Remove previous owner from the chain...`);
  const removePrevOwnerRequest = await arbitrumChainPublicClient.arbOwnerPrepareTransactionRequest({
    functionName: 'removeChainOwner',
    args: [chainOwner.address],
    upgradeExecutor: tokenBridgeContracts.orbitChainContracts.upgradeExecutor,
    account: chainOwner.address,
  });
  const removePrevOwnerTxHash = await arbitrumChainPublicClient.sendRawTransaction({
    serializedTransaction: await chainOwner.signTransaction(removePrevOwnerRequest),
  });
  console.log(
    `Done! Transaction hash on arbitrum chain: ${getBlockExplorerUrl(
      chainInformation,
    )}/tx/${removePrevOwnerTxHash}`,
  );
};

// Calling main
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
