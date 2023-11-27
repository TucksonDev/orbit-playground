import { Chain } from 'viem';
import { generatePrivateKey } from 'viem/accounts';
import { arbitrum, arbitrumNova, arbitrumGoerli, arbitrumSepolia } from 'viem/chains';
import { OrbitDeploymentContracts } from './types';
import { orbitDeploymentContracts } from './contracts';

const supportedChains = { arbitrum, arbitrumNova, arbitrumGoerli, arbitrumSepolia };

export const sanitizePrivateKey = (privateKey: string): `0x${string}` => {
  if (!privateKey.startsWith('0x')) {
    return `0x${privateKey}`;
  }

  return privateKey as `0x${string}`;
};

export const getBlockExplorerUrl = (chain: Chain) => {
  return chain.blockExplorers?.default.url;
};

export const withFallbackPrivateKey = (privateKey: string | undefined): `0x${string}` => {
  if (typeof privateKey === 'undefined') {
    return generatePrivateKey();
  }

  return sanitizePrivateKey(privateKey);
};

export const getChainConfigFromChainId = (chainId: number) => {
  for (const chain of Object.values(supportedChains)) {
    if ('id' in chain) {
      if (chain.id === chainId) {
        return chain;
      }
    }
  }

  throw new Error(`Chain id ${chainId} not found`);
};

export const getContractsFromChainId = (chainId: number): OrbitDeploymentContracts => {
  if (!orbitDeploymentContracts[chainId]) {
    throw new Error(`No deployment contracts found for chain id ${chainId}`);
  }

  return orbitDeploymentContracts[chainId];
};

export const getRpcUrl = (chain: Chain) => {
  return chain.rpcUrls.default.http[0];
};
