import { Chain, defineChain } from 'viem';
import { generatePrivateKey } from 'viem/accounts';
import { arbitrum, arbitrumNova, arbitrumGoerli, arbitrumSepolia } from 'viem/chains';
import { OrbitDeploymentContracts } from './types';
import { orbitDeploymentContracts } from './contracts';
import { readFileSync, writeFileSync } from 'fs';
import { NodeConfig } from '@arbitrum/orbit-sdk';
import * as readline from 'readline';
import 'dotenv/config';

const supportedChains = { arbitrum, arbitrumNova, arbitrumGoerli, arbitrumSepolia };

//
// Small helpers
//
export const delay = (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export const promptQuestion = (question: string): Promise<string> => {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(`${question}: `, (answer) => {
      resolve(answer);
      rl.close();
    });
  });
};

//
// Viem helpers
//
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

export const getRpcUrl = (chain: Chain) => {
  return chain.rpcUrls.default.http[0];
};

//
// Contract helpers
//
export const getContractsFromChainId = (chainId: number): OrbitDeploymentContracts => {
  if (!orbitDeploymentContracts[chainId]) {
    throw new Error(`No deployment contracts found for chain id ${chainId}`);
  }

  return orbitDeploymentContracts[chainId];
};

//
// Configuration helpers
//
export const getNodeConfigFileLocation = (): {
  dir: string;
  fileName: string;
} => {
  const configDir = process.env.CHAIN_CONFIG_FOLDER || 'chainConfig';
  const nodeConfigFilename = (process.env.NODE_CONFIG_FILENAME || 'node-config') + '.json';
  return {
    dir: configDir,
    fileName: nodeConfigFilename,
  };
};

export const saveNodeConfigFile = (nodeConfig: NodeConfig): string => {
  const configDir = process.env.CHAIN_CONFIG_FOLDER || 'chainConfig';
  const nodeConfigFilename = (process.env.NODE_CONFIG_FILENAME || 'node-config') + '.json';
  const filePath = configDir + '/' + nodeConfigFilename;
  writeFileSync(filePath, JSON.stringify(nodeConfig, null, 2));

  return filePath;
};

export const readNodeConfigFile = (): NodeConfig => {
  const configDir = process.env.CHAIN_CONFIG_FOLDER || 'chainConfig';
  const nodeConfigFilename = (process.env.NODE_CONFIG_FILENAME || 'node-config') + '.json';
  const filePath = configDir + '/' + nodeConfigFilename;
  return JSON.parse(readFileSync(filePath, 'utf8'));
};

export const getOrbitChainInformation = () => {
  if (!process.env.ORBIT_CHAIN_RPC || !process.env.ORBIT_CHAIN_BLOCK_EXPLORER) {
    throw new Error(
      `Can't get orbitChainConfig without ORBIT_CHAIN_RPC and ORBIT_CHAIN_BLOCK_EXPLORER. Set these variables in the .env file.`,
    );
  }

  const nodeConfig = readNodeConfigFile();
  const orbitChainConfig = JSON.parse(nodeConfig.chain['info-json'])[0];
  const orbitChainId = Number(orbitChainConfig['chain-id']);

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
        http: [process.env.ORBIT_CHAIN_RPC],
      },
      public: {
        http: [process.env.ORBIT_CHAIN_RPC],
      },
    },
    blockExplorers: {
      default: { name: 'Blockscout', url: process.env.ORBIT_CHAIN_BLOCK_EXPLORER },
    },
  });
};

export const getOrbitChainConfiguration = () => {
  const nodeConfig = readNodeConfigFile();
  const orbitChainConfig = JSON.parse(nodeConfig.chain['info-json'])[0];
  return orbitChainConfig;
};
