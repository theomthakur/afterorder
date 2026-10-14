import type { ReactNode } from 'react';
import { DynamicContextProvider } from '@dynamic-labs/sdk-react-core';
import { EthereumWalletConnectors } from '@dynamic-labs/ethereum';

const monadTestnet = {
  chainId: 10143, networkId: 10143, name: 'Monad Testnet', vanityName: 'Monad Testnet', chainName: 'Monad Testnet',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: ['https://testnet-rpc.monad.xyz'], blockExplorerUrls: ['https://testnet.monadvision.com'], iconUrls: ['https://afterorder-six.vercel.app/favicon.svg'],
};

export function DynamicShell({ environmentId, children }: { environmentId: string; children: ReactNode }) {
  return <DynamicContextProvider settings={{ environmentId, walletConnectors: [EthereumWalletConnectors], overrides: { evmNetworks: [monadTestnet] } }}>{children}</DynamicContextProvider>;
}
