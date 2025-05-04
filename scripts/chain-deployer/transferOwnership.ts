import { createPublicClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbOwnerPublicActions } from '@arbitrum/orbit-sdk';
import {
  getBlockExplorerUrl,
  sanitizePrivateKey,
  getOrbitChainInformation,
  readTokenBridgeContractsFile,
} from '../../src/utils';
import 'dotenv/config';

// Check for required env variables
if (!process.env.CHAIN_OWNER_PRIVATE_KEY) {
  throw new Error('The following environment variables must be present: CHAIN_OWNER_PRIVATE_KEY');
}

// Load accounts
const chainOwner = privateKeyToAccount(sanitizePrivateKey(process.env.CHAIN_OWNER_PRIVATE_KEY));

// Set the orbit chain and create a public client for it
const orbitChainInformation = getOrbitChainInformation();
const orbitChainPublicClient = createPublicClient({
  chain: orbitChainInformation,
  transport: http(),
}).extend(arbOwnerPublicActions);

const main = async () => {
  console.log('*******************************************************');
  console.log('* Orbit chain - Transfer ownership to UpgradeExecutor *');
  console.log('*******************************************************');
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
    await orbitChainPublicClient.arbOwnerPrepareTransactionRequest({
      functionName: 'addChainOwner',
      args: [tokenBridgeContracts.orbitChainContracts.upgradeExecutor],
      upgradeExecutor: false,
      account: chainOwner.address,
    });
  const addOwnerUpgradeExecutorTxHash = await orbitChainPublicClient.sendRawTransaction({
    serializedTransaction: await chainOwner.signTransaction(addOwnerUpgradeExecutorRequest),
  });
  console.log(
    `Done! Transaction hash on orbit chain: ${getBlockExplorerUrl(
      orbitChainInformation,
    )}/tx/${addOwnerUpgradeExecutorTxHash}`,
  );

  console.log(`Remove previous owner from the chain...`);
  const removePrevOwnerRequest = await orbitChainPublicClient.arbOwnerPrepareTransactionRequest({
    functionName: 'removeChainOwner',
    args: [chainOwner.address],
    upgradeExecutor: tokenBridgeContracts.orbitChainContracts.upgradeExecutor,
    account: chainOwner.address,
  });
  const removePrevOwnerTxHash = await orbitChainPublicClient.sendRawTransaction({
    serializedTransaction: await chainOwner.signTransaction(removePrevOwnerRequest),
  });
  console.log(
    `Done! Transaction hash on orbit chain: ${getBlockExplorerUrl(
      orbitChainInformation,
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
