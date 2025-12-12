import { Address, Chain, defineChain, parseAbi, PublicClient, zeroAddress } from 'viem';
import { readNodeConfigFile } from './node-configuration';
import 'dotenv/config';

export const getChainInformation = () => {
  if (!process.env.NITRO_RPC_URL || !process.env.NITRO_PORT) {
    throw new Error(
      `Can't get arbitrumChainConfig without NITRO_RPC_URL and NITRO_PORT. Set these variables in the .env file.`,
    );
  }

  const nodeConfig = readNodeConfigFile('rpc');
  const arbitrumChainConfig = JSON.parse(nodeConfig.chain!['info-json']!)[0];
  const chainId = Number(arbitrumChainConfig['chain-id']);

  const chainRpc = process.env.NITRO_RPC_URL + ':' + process.env.NITRO_PORT;
  const blockExplorerUrl = 'http://localhost';

  return defineChain({
    id: chainId,
    name: arbitrumChainConfig['chain-name'],
    network: 'arbitrum-chain',
    nativeCurrency: {
      name: 'ETH',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrls: {
      default: {
        http: [chainRpc],
      },
      public: {
        http: [chainRpc],
      },
    },
    blockExplorers: {
      default: { name: 'Blockscout', url: blockExplorerUrl },
    },
  });
};

export const getChainConfiguration = () => {
  const nodeConfig = readNodeConfigFile('rpc');
  const arbitrumChainConfig = JSON.parse(nodeConfig.chain!['info-json']!)[0];
  return arbitrumChainConfig;
};

export const chainIsL1 = (chain: Chain) => {
  return chain.id == 1 || chain.id == 11155111;
};

export const chainIsAnytrust = (): boolean => {
  const arbitrumChainConfig = getChainConfiguration();
  if (arbitrumChainConfig['chain-config'].arbitrum.DataAvailabilityCommittee == true) {
    return true;
  }

  return false;
};

export const getChainNativeToken = async (
  parentChainPublicClient: PublicClient,
): Promise<string> => {
  const arbitrumChainConfig = getChainConfiguration();
  const bridge = arbitrumChainConfig.rollup.bridge;
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
  const arbitrumChainConfig = getChainConfiguration();
  return arbitrumChainConfig.rollup['stake-token'] as Address;
};

export const getChainBaseStake = async (parentChainPublicClient: PublicClient): Promise<bigint> => {
  const arbitrumChainConfig = getChainConfiguration();
  const rollup = arbitrumChainConfig.rollup.rollup;
  const baseStake = await parentChainPublicClient.readContract({
    address: rollup,
    abi: parseAbi(['function baseStake() public view returns (uint256)']),
    functionName: 'baseStake',
  });

  return baseStake;
};
