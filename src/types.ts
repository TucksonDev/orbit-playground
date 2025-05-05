import { Address } from 'viem';

export interface OrbitConfig {
  'chainOwner': string;
  'rollup': string;
  'inbox': string;
  'outbox': string;
  'adminProxy': string;
  'sequencerInbox': string;
  'bridge': string;
  'utils': string;
  'validatorWalletCreator': string;
  'deployedAtBlockNumber': number;
  'minL2BaseFee': number;
  'networkFeeReceiver': string;
  'infrastructureFeeCollector': string;
  'batchPoster': string;
  'staker': string;
  'chainId': number;
  'chainName': string;
  'parentChainId': number;
  'parent-chain-node-url': string;
  'nativeToken': string;
}

export interface OrbitChainInformation {
  chainId: number;
  chainName: string;
  rpcUrl: string;
  nativeToken: {
    name: string;
    symbol: string;
    decimals: number;
  };
  blockexplorerUrl: string;
}

export type OrbitDeploymentContracts = {
  rollupCreator: Address;
  tokenBridgeCreator: Address;
};

export type OrbitDeploymentContractsMap = {
  [key: number]: OrbitDeploymentContracts;
};

/*
  Temporary type definitions
  (This are likely to be exposed or added on the Orbit SDK in the future)
*/
type TokenBridgeParentChainContracts = {
  router: Address;
  standardGateway: Address;
  customGateway: Address;
  wethGateway: Address;
  weth: Address;
  multicall: Address;
};

type TokenBridgeOrbitChainContracts = {
  router: Address;
  standardGateway: Address;
  customGateway: Address;
  wethGateway: Address;
  weth: Address;
  proxyAdmin: Address;
  beaconProxyFactory: Address;
  upgradeExecutor: Address;
  multicall: Address;
};

export type TokenBridgeContracts = {
  parentChainContracts: TokenBridgeParentChainContracts;
  orbitChainContracts: TokenBridgeOrbitChainContracts;
};

export type DasNodeConfig = {
  'data-availability': {
    'parent-chain-node-url': string;
    'sequencer-inbox-address': string;
    'key': {
      'key-dir': string;
    };
    'local-cache': {
      enable: boolean;
    };
    'local-file-storage'?: {
      'enable'?: boolean;
      'data-dir'?: string;
    };
  };
  'enable-rpc'?: boolean;
  'rpc-addr'?: string;
  'enable-rest'?: boolean;
  'rest-addr'?: string;
  'log-level'?: string;
};
