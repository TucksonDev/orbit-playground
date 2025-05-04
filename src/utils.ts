import { Chain, defineChain } from 'viem';
import { generatePrivateKey } from 'viem/accounts';
import { mainnet, sepolia, arbitrum, arbitrumNova, arbitrumSepolia } from 'viem/chains';
import { OrbitDeploymentContracts, TokenBridgeContracts } from './types';
import { orbitDeploymentContracts } from './contracts';
import { readFileSync, writeFileSync } from 'fs';
import { CoreContracts, NodeConfig } from '@arbitrum/orbit-sdk';
import * as readline from 'readline';
import 'dotenv/config';

const supportedChains = { mainnet, sepolia, arbitrum, arbitrumNova, arbitrumSepolia };

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

export const saveCoreContractsFile = (coreContracts: CoreContracts): string => {
  const configDir = process.env.CHAIN_CONFIG_FOLDER || 'chainConfig';
  const coreContractsFilename = 'core-contracts.json';
  const filePath = configDir + '/' + coreContractsFilename;
  writeFileSync(filePath, JSON.stringify(coreContracts, null, 2));

  return filePath;
};

export const readCoreContractsFile = (): CoreContracts => {
  const configDir = process.env.CHAIN_CONFIG_FOLDER || 'chainConfig';
  const coreContractsFilename = 'core-contracts.json';
  const filePath = configDir + '/' + coreContractsFilename;
  return JSON.parse(readFileSync(filePath, 'utf8'));
};

// TODO: once TokenBridgeContracts is exported in the Orbit SDK, change the type of the parameter received
export const saveTokenBridgeContractsFile = (
  tokenBridgeContracts: TokenBridgeContracts,
): string => {
  const configDir = process.env.CHAIN_CONFIG_FOLDER || 'chainConfig';
  const tokenBridgeContractsFilename = 'token-bridge-contracts.json';
  const filePath = configDir + '/' + tokenBridgeContractsFilename;
  writeFileSync(filePath, JSON.stringify(tokenBridgeContracts, null, 2));

  return filePath;
};

export const readTokenBridgeContractsFile = (): TokenBridgeContracts => {
  const configDir = process.env.CHAIN_CONFIG_FOLDER || 'chainConfig';
  const tokenBridgeContractsFilename = 'token-bridge-contracts.json';
  const filePath = configDir + '/' + tokenBridgeContractsFilename;
  return JSON.parse(readFileSync(filePath, 'utf8'));
};

export const getOrbitChainInformation = () => {
  if (
    !process.env.NITRO_RPC_URL ||
    !process.env.NITRO_PORT ||
    !process.env.BLOCK_EXPLORER_URL ||
    !process.env.BLOCK_EXPLORER_PORT
  ) {
    throw new Error(
      `Can't get orbitChainConfig without NITRO_RPC_URL, NITRO_PORT, BLOCK_EXPLORER_URL and BLOCK_EXPLORER_PORT. Set these variables in the .env file.`,
    );
  }

  const nodeConfig = readNodeConfigFile();
  const orbitChainConfig = JSON.parse(nodeConfig.chain!['info-json']!)[0];
  const orbitChainId = Number(orbitChainConfig['chain-id']);

  const orbitChainRpc = process.env.NITRO_RPC_URL + ':' + process.env.NITRO_PORT;
  const blockExplorerUrl = process.env.BLOCK_EXPLORER_URL + ':' + process.env.BLOCK_EXPLORER_PORT;

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
  const nodeConfig = readNodeConfigFile();
  const orbitChainConfig = JSON.parse(nodeConfig.chain!['info-json']!)[0];
  return orbitChainConfig;
};

export const chainIsL1 = (chain: Chain) => {
  return chain.id == 1 || chain.id == 11155111;
};
