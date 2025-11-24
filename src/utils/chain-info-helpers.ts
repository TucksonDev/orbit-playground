import { Address, Chain, defineChain, parseAbi, PublicClient, zeroAddress } from 'viem';
import { readNodeConfigFile } from './node-configuration';
import 'dotenv/config';

export const getOrbitChainInformation = () => {
  if (!process.env.NITRO_RPC_URL || !process.env.NITRO_PORT) {
    throw new Error(
      `Can't get orbitChainConfig without NITRO_RPC_URL and NITRO_PORT. Set these variables in the .env file.`,
    );
  }

  const nodeConfig = readNodeConfigFile('rpc');
  const orbitChainConfig = JSON.parse(nodeConfig.chain!['info-json']!)[0];
  const orbitChainId = Number(orbitChainConfig['chain-id']);

  const orbitChainRpc = process.env.NITRO_RPC_URL + ':' + process.env.NITRO_PORT;
  const blockExplorerUrl = 'http://localhost';

  return defineChain({
    id: orbitChainId,
    name: orbitChainConfig['chain-name'],
    network: 'orbit',
    nativeCurrency: {
      name: 'ETH',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrls: {
      default: {
        http: [orbitChainRpc],
      },
      public: {
        http: [orbitChainRpc],
      },
    },
    blockExplorers: {
      default: { name: 'Blockscout', url: blockExplorerUrl },
    },
  });
};

export const getOrbitChainConfiguration = () => {
  const nodeConfig = readNodeConfigFile('rpc');
  const orbitChainConfig = JSON.parse(nodeConfig.chain!['info-json']!)[0];
  return orbitChainConfig;
};

export const chainIsL1 = (chain: Chain) => {
  return chain.id == 1 || chain.id == 11155111;
};

export const chainIsAnytrust = (): boolean => {
  const orbitChainConfig = getOrbitChainConfiguration();
  if (orbitChainConfig['chain-config'].arbitrum.DataAvailabilityCommittee == true) {
    return true;
  }

  return false;
};

export const getChainNativeToken = async (
  parentChainPublicClient: PublicClient,
): Promise<string> => {
  const orbitChainConfig = getOrbitChainConfiguration();
  const bridge = orbitChainConfig.rollup.bridge;
  let nativeToken: string = zeroAddress;
  try {
    const bridgeNativeToken = await parentChainPublicClient.readContract({
      address: bridge,
      abi: parseAbi(['function nativeToken() public view returns (address)']),
      functionName: 'nativeToken',
    });
    nativeToken = bridgeNativeToken;
  } catch (e) {
    // No need to do anything. Native token stays the zero address.
  }

  return nativeToken;
};

export const getChainStakeToken = (): Address => {
  const orbitChainConfig = getOrbitChainConfiguration();
  return orbitChainConfig.rollup['stake-token'] as Address;
};

export const getChainBaseStake = async (parentChainPublicClient: PublicClient): Promise<bigint> => {
  const orbitChainConfig = getOrbitChainConfiguration();
  const rollup = orbitChainConfig.rollup.rollup;
  const baseStake = await parentChainPublicClient.readContract({
    address: rollup,
    abi: parseAbi(['function baseStake() public view returns (uint256)']),
    functionName: 'baseStake',
  });

  return baseStake;
};
