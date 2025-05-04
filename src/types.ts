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
