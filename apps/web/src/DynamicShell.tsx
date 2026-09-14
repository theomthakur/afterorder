import type { ReactNode } from 'react';
import { DynamicContextProvider } from '@dynamic-labs/sdk-react-core';
import { EthereumWalletConnectors } from '@dynamic-labs/ethereum';

export function DynamicShell({ environmentId, children }: { environmentId: string; children: ReactNode }) {
  return <DynamicContextProvider settings={{ environmentId, walletConnectors: [EthereumWalletConnectors] }}>{children}</DynamicContextProvider>;
}
