import { createPublicClient, createWalletClient, http, parseAbi, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { createRollupFetchCoreContracts } from '@arbitrum/orbit-sdk';
import {
  getBlockExplorerUrl,
  getChainConfigFromChainId,
  sanitizePrivateKey,
  getOrbitChainInformation,
  delay,
  getOrbitChainConfiguration,
  getRpcUrl,
} from '../../src/utils';
import 'dotenv/config';

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
const batchPosterAddress = privateKeyToAccount(
  sanitizePrivateKey(process.env.BATCH_POSTER_PRIVATE_KEY),
).address;
const validatorAddress = privateKeyToAccount(
  sanitizePrivateKey(process.env.STAKER_PRIVATE_KEY),
).address;

// Set the parent chain and create a wallet client for it
const parentChainId = Number(orbitChainConfig['parent-chain-id']);
const parentChainInformation = getChainConfigFromChainId(parentChainId);
const parentChainWalletClient = createWalletClient({
  account: chainOwner,
  chain: parentChainInformation,
  transport: http(process.env.PARENT_CHAIN_RPC_URL || getRpcUrl(parentChainInformation)),
});
const parentChainPublicClient = createPublicClient({
  chain: parentChainInformation,
  transport: http(process.env.PARENT_CHAIN_RPC_URL || getRpcUrl(parentChainInformation)),
});

const orbitChainInformation = getOrbitChainInformation();
const orbitChainPublicClient = createPublicClient({
  chain: orbitChainInformation,
  transport: http(),
});

// Amount constants
const fundingAmount = process.env.FUNDING_AMOUNT || '0.3';

const main = async () => {
  console.log('***************************');
  console.log('* Orbit chain initializer *');
  console.log('***************************');
  console.log('');

  //
  // Getting the core contracts
  //
  const coreContracts = await createRollupFetchCoreContracts({
    rollup: orbitChainConfig.rollup.rollup,
    rollupDeploymentBlockNumber: BigInt(orbitChainConfig.rollup['deployed-at']),
    publicClient: parentChainPublicClient,
  });

  //
  // Funding the batch poster and staker accounts in the parent chain
  //
  const fundingAmountWei = parseEther(fundingAmount);

  console.log(`Fund batch poster account on parent chain with ${fundingAmount} ETH...`);
  const fundBatchPosterTxHash = await parentChainWalletClient.sendTransaction({
    to: batchPosterAddress,
    value: fundingAmountWei,
  });
  console.log(
    `Done! Transaction hash on parent chain: ${getBlockExplorerUrl(
      parentChainInformation,
    )}/tx/${fundBatchPosterTxHash}`,
  );
  // NOTE: it looks like viem is not handling the nonce correctly when making calls this quickly.
  // Adding a delay of 10 seconds solves this issue.
  await delay(10 * 1000);

  console.log(`Fund staker account on parent chain with ${fundingAmount} ETH...`);
  const fundStakerTxHash = await parentChainWalletClient.sendTransaction({
    to: validatorAddress,
    value: fundingAmountWei,
  });
  console.log(
    `Done! Transaction hash on parent chain: ${getBlockExplorerUrl(
      parentChainInformation,
    )}/tx/${fundStakerTxHash}`,
  );
  // NOTE: it looks like viem is not handling the nonce correctly when making calls this quickly.
  // Adding a delay of 10 seconds solves this issue.
  await delay(10 * 1000);

  //
  // Funding the deployer account in the Orbit chain
  //
  console.log(`Fund deployer account on orbit chain with ${fundingAmount} ETH...`);
  const startBalance = await orbitChainPublicClient.getBalance({
    address: chainOwner.address,
  });
  const { request } = await parentChainPublicClient.simulateContract({
    account: chainOwner,
    address: coreContracts.inbox,
    abi: parseAbi(['function depositEth() public payable']),
    functionName: 'depositEth',
    value: fundingAmountWei,
  });
  const fundDeployerTxHash = await parentChainWalletClient.writeContract(request);
  console.log(
    `Done! Transaction hash on parent chain: ${getBlockExplorerUrl(
      parentChainInformation,
    )}/tx/${fundDeployerTxHash}`,
  );

  // Wait for balance to be updated
  console.log(`Waiting for funds to arrive to the Orbit chain (it might take a few minutes)...`);
  while (true) {
    // eslint-disable-next-line no-await-in-loop
    const currentBalance = await orbitChainPublicClient.getBalance({
      address: chainOwner.address,
    });
    if (currentBalance - startBalance >= fundingAmountWei) {
      console.log(`Deployer account has been funded on the Orbit chain.`);
      break;
    }

    // eslint-disable-next-line no-await-in-loop
    await delay(30 * 1000);
  }
};

// Calling main
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
