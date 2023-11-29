import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  http,
  parseAbi,
  parseEther,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  getChainConfigFromChainId,
  sanitizePrivateKey,
  getOrbitChainConfiguration,
  getBlockExplorerUrl,
} from '../src/utils';
import 'dotenv/config';

// Check for required env variables
if (!process.env.CHAIN_OWNER_PRIVATE_KEY) {
  throw new Error('The following environment variables must be present: CHAIN_OWNER_PRIVATE_KEY');
}

// Get Orbit configuration
const orbitChainConfig = getOrbitChainConfiguration();

// Load accounts
const chainOwner = privateKeyToAccount(sanitizePrivateKey(process.env.CHAIN_OWNER_PRIVATE_KEY));

// Create a public and wallet client for the parent chain
const parentChainId = Number(orbitChainConfig['parent-chain-id']);
const parentChainInformation = getChainConfigFromChainId(parentChainId);
const parentChainWalletClient = createWalletClient({
  account: chainOwner,
  chain: parentChainInformation,
  transport: http(),
});
const parentChainPublicClient = createPublicClient({
  chain: parentChainInformation,
  transport: http(),
});

// Contract constants
const rollupAddress = orbitChainConfig.rollup.rollup;
const inboxAddress = orbitChainConfig.rollup.inbox;

const main = async (newWasmModuleRoot: `0x${string}`) => {
  console.log('****************************');
  console.log('* Orbit chain WASM updater *');
  console.log('****************************');
  console.log('');

  //
  // Getting the current WASM module root
  //
  console.log(`Getting the current WASM module root...`);
  const currentWasmModuleRoot = await parentChainPublicClient.readContract({
    address: rollupAddress,
    abi: parseAbi(['function wasmModuleRoot() public view returns (bytes32)']),
    functionName: 'wasmModuleRoot',
  });
  console.log(`Current WASM module root is: ${currentWasmModuleRoot}`);

  //
  // Check if the new WASM module root is different
  //
  if (currentWasmModuleRoot == newWasmModuleRoot) {
    console.log(`Current WASM module root is equal to the new WASM module root. Aborting.`);
    return;
  }

  //
  // Finding the UpgradeExecutor through the ProxyAdmin
  //  (This will probably be added to the Orbit SDK at some point)
  //
  console.log(`Getting the UpgradeExecutor contract address...`);
  const proxyAdminAddress = await parentChainPublicClient.readContract({
    address: inboxAddress,
    abi: parseAbi(['function getProxyAdmin() public view returns (address)']),
    functionName: 'getProxyAdmin',
  });
  const upgradeExecutorAddress = await parentChainPublicClient.readContract({
    address: proxyAdminAddress,
    abi: parseAbi(['function owner() public view returns (address)']),
    functionName: 'owner',
  });
  console.log(`UpgradeExecutor at ${upgradeExecutorAddress}`);

  //
  // Updating the WASM module root received by parameter
  //
  const calldata = encodeFunctionData({
    abi: parseAbi(['function setWasmModuleRoot(bytes32) external']),
    functionName: 'setWasmModuleRoot',
    args: [newWasmModuleRoot],
  });
  // Hardcoding some value for now
  const callvalue = parseEther('0.01');

  console.log(`Updating the WASM module root to ${newWasmModuleRoot}...`);
  const { request } = await parentChainPublicClient.simulateContract({
    account: chainOwner,
    address: upgradeExecutorAddress,
    abi: parseAbi(['function executeCall(address, bytes) public payable']),
    functionName: 'executeCall',
    args: [rollupAddress, calldata],
    value: callvalue,
  });
  const wasmModuleRootUpdateTxHash = await parentChainWalletClient.writeContract(request);
  console.log(
    `Done! Transaction hash on parent chain: ${getBlockExplorerUrl(
      parentChainInformation,
    )}/tx/${wasmModuleRootUpdateTxHash}`,
  );
};

// Getting the WASM module root to update from the command arguments
if (process.argv.length < 3) {
  console.log(`Missing WASM module root to update`);
  console.log(`Usage: yarn updateWASM <WASM module root>`);
  process.exit();
}

const wasmModuleRoot = process.argv[2] as `0x${string}`;

// Calling main
main(wasmModuleRoot)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
