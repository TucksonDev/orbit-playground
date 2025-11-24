import { Address } from 'viem';
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'fs';
import { NodeConfig } from '@arbitrum/orbit-sdk';
import { DasNodeConfig, NodeType } from '../types';
import 'dotenv/config';

export const getNodeConfigFileName = (nodeType: NodeType): string => {
  switch (nodeType) {
    case 'batch-poster':
      return 'batch-poster-config.json';
    case 'staker':
      return 'staker-config.json';
  }

  return 'rpc-config.json';
};

export const getNodeConfigFileLocation = (
  nodeType: NodeType,
): {
  dir: string;
  fileName: string;
} => {
  const configDir = 'chainConfig/' + nodeType;
  const nodeConfigFilename = getNodeConfigFileName(nodeType);
  return {
    dir: configDir,
    fileName: nodeConfigFilename,
  };
};

export const saveNodeConfigFile = (nodeType: NodeType, nodeConfig: NodeConfig): string => {
  const configDir = 'chainConfig/' + nodeType;
  const nodeConfigFilename = getNodeConfigFileName(nodeType);
  const filePath = configDir + '/' + nodeConfigFilename;
  writeFileSync(filePath, JSON.stringify(nodeConfig, null, 2));

  return filePath;
};

export const readNodeConfigFile = (nodeType: NodeType): NodeConfig => {
  const configDir = 'chainConfig/' + nodeType;
  const nodeConfigFilename = getNodeConfigFileName(nodeType);
  const filePath = configDir + '/' + nodeConfigFilename;
  return JSON.parse(readFileSync(filePath, 'utf8'));
};

export const splitConfigPerType = (
  baseNodeConfig: NodeConfig,
): {
  batchPosterConfig: NodeConfig;
  stakerConfig: NodeConfig;
  rpcConfig: NodeConfig;
} => {
  // Batch poster config
  const batchPosterConfig = JSON.parse(JSON.stringify(baseNodeConfig));
  if (batchPosterConfig.node && batchPosterConfig.node.staker) {
    delete batchPosterConfig.node.staker;
  }
  if (
    batchPosterConfig.node &&
    batchPosterConfig.node.bold &&
    batchPosterConfig.node.bold.strategy
  ) {
    delete batchPosterConfig.node.bold.strategy;
  }
  if (
    batchPosterConfig.node &&
    batchPosterConfig.node.bold &&
    batchPosterConfig.node.bold['assertion-posting-interval']
  ) {
    delete batchPosterConfig.node.bold['assertion-posting-interval'];
  }

  // Staker config
  const stakerConfig = JSON.parse(JSON.stringify(baseNodeConfig));
  if (stakerConfig.node && stakerConfig.node.sequencer) {
    delete stakerConfig.node.sequencer;
  }
  if (stakerConfig.node && stakerConfig.node['delayed-sequencer']) {
    delete stakerConfig.node['delayed-sequencer'];
  }
  if (stakerConfig.node && stakerConfig.node['batch-poster']) {
    delete stakerConfig.node['batch-poster'];
  }
  if (
    stakerConfig.node &&
    stakerConfig.node.dangerous &&
    stakerConfig.node.dangerous['no-sequencer-coordinator']
  ) {
    delete stakerConfig.node.dangerous['no-sequencer-coordinator'];
  }
  if (stakerConfig.execution && stakerConfig.execution.sequencer) {
    delete stakerConfig.execution.sequencer;
  }

  // RPC config
  const rpcConfig = JSON.parse(JSON.stringify(stakerConfig));
  if (rpcConfig.node && rpcConfig.node.staker) {
    delete rpcConfig.node.staker;
  }
  if (rpcConfig.node && rpcConfig.node.bold && rpcConfig.node.bold.strategy) {
    delete rpcConfig.node.bold.strategy;
  }
  if (rpcConfig.node && rpcConfig.node.bold && rpcConfig.node.bold['assertion-posting-interval']) {
    delete rpcConfig.node.bold['assertion-posting-interval'];
  }

  return {
    batchPosterConfig,
    stakerConfig,
    rpcConfig,
  };
};

export const distributeGenesisFileToNodeFolders = (genesisFilePath: string) => {
  if (!existsSync(genesisFilePath)) {
    // Not throwing here to not break the flow if the genesis file is not provided
    console.log('Genesis file not found at path:', genesisFilePath);
    return;
  }

  const nodeTypes: NodeType[] = ['batch-poster', 'staker', 'rpc'];
  for (const nodeType of nodeTypes) {
    copyFileSync(genesisFilePath, getNodeConfigFileLocation(nodeType).dir + '/genesis.json');
  }
};

export const prepareDasConfig = (
  parentChainRpc: string,
  sequencerInboxAddress: Address,
): DasNodeConfig => {
  const dasNodeConfig: DasNodeConfig = {
    'data-availability': {
      'parent-chain-node-url': parentChainRpc,
      'sequencer-inbox-address': sequencerInboxAddress,
      'key': {
        'key-dir': '/home/user/.arbitrum/keys',
      },
      'local-cache': {
        enable: true,
      },
      'local-file-storage': {
        'enable': true,
        'data-dir': '/home/user/das-data',
      },
    },
    'enable-rpc': true,
    'rpc-addr': '0.0.0.0',
    'enable-rest': true,
    'rest-addr': '0.0.0.0',
    'log-level': 'INFO',
  };

  return dasNodeConfig;
};

export const saveDasNodeConfigFile = (dasNodeConfig: DasNodeConfig): string => {
  const configDir = 'chainConfig/das-server';
  const dasNodeConfigFilename = 'das-config.json';
  const filePath = configDir + '/' + dasNodeConfigFilename;
  writeFileSync(filePath, JSON.stringify(dasNodeConfig, null, 2));

  return filePath;
};
