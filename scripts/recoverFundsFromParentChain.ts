import 'dotenv/config';
import {
  getBlockExplorerUrl,
  getChainConfigFromChainId,
  getOrbitChainConfiguration,
  promptQuestion,
  sanitizePrivateKey,
} from '../src/utils';
import { privateKeyToAccount } from 'viem/accounts';
import { createPublicClient, createWalletClient, http, parseEther } from 'viem';

// Check for required env variables
if (
  !process.env.CHAIN_OWNER_PRIVATE_KEY ||
  !process.env.BATCH_POSTER_PRIVATE_KEY ||
  !process.env.STAKER_PRIVATE_KEY
) {
  throw new Error(
    'The following environment variables must be present: CHAIN_OWNER_PRIVATE_KEY, BATCH_POSTER_PRIVATE_KEY, STAKER_PRIVATE_KEY',
  );
}

// Get Orbit configuration
const orbitChainConfig = getOrbitChainConfiguration();

// Load accounts
const chainOwner = privateKeyToAccount(sanitizePrivateKey(process.env.CHAIN_OWNER_PRIVATE_KEY));
const batchPoster = privateKeyToAccount(sanitizePrivateKey(process.env.BATCH_POSTER_PRIVATE_KEY));
const staker = privateKeyToAccount(sanitizePrivateKey(process.env.STAKER_PRIVATE_KEY));

// Set the parent chain and create a wallet client for it
const parentChainId = Number(orbitChainConfig['parent-chain-id']);
const parentChainInformation = getChainConfigFromChainId(parentChainId);
const parentChainWalletClient = createWalletClient({
  chain: parentChainInformation,
  transport: http(),
});
const parentChainPublicClient = createPublicClient({
  chain: parentChainInformation,
  transport: http(),
});

const main = async () => {
  console.log('****************************************');
  console.log('* Funds recovery script (Parent chain) *');
  console.log('****************************************');
  console.log(
    'WARNING: This script will empty the default staker and batch poster wallets of your chain. This means that they will be unable to process their actions on the parent chain.',
  );
  console.log(`Use only if you don't want to keep using this Orbit chain.`);
  const answer = await promptQuestion('Do you want to continue? y/N: ');
  if (answer.toLowerCase() != 'y') {
    console.log('Aborting...');
    return;
  }
  console.log('');

  // Recover funds from the batch poster (on the parent chain)
  console.log(`Transferring funds from the batch poster wallet...`);
  const batchPosterBalance = await parentChainPublicClient.getBalance({
    address: batchPoster.address,
  });
  const emptyBatchPosterTxHash = await parentChainWalletClient.sendTransaction({
    account: batchPoster,
    to: chainOwner.address,
    value: batchPosterBalance - parseEther('0.01'),
  });
  console.log(
    `Done! Transaction hash on parent chain: ${getBlockExplorerUrl(
      parentChainInformation,
    )}/tx/${emptyBatchPosterTxHash}`,
  );

  // Recover funds from the staker (on the parent chain)
  console.log(`Transferring funds from the staker wallet...`);
  const stakerBalance = await parentChainPublicClient.getBalance({
    address: staker.address,
  });
  const emptyStakerTxHash = await parentChainWalletClient.sendTransaction({
    account: staker,
    to: chainOwner.address,
    value: stakerBalance - parseEther('0.01'),
  });
  console.log(
    `Done! Transaction hash on parent chain: ${getBlockExplorerUrl(
      parentChainInformation,
    )}/tx/${emptyStakerTxHash}`,
  );
};

// Calling main
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
