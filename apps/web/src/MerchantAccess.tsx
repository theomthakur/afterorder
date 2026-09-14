import { useState } from 'react';
import { DynamicWidget, useDynamicContext } from '@dynamic-labs/sdk-react-core';

export function MerchantAccess() {
  const { primaryWallet } = useDynamicContext();
  const [authorized, setAuthorized] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!primaryWallet) return <DynamicWidget />;

  const authorize = async () => {
    setBusy(true);
    try {
      const message = `AfterOrder merchant authorization\nWallet: ${primaryWallet.address}\nMaximum: 40 DemoUSD per order\nPurpose: supplier fulfillment on Monad testnet`;
      const signature = await primaryWallet.signMessage(message);
      if (!signature) throw new Error('The wallet did not return a signature');
      const response = await fetch('/api/merchant/authorization', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address: primaryWallet.address, message, signature }) });
      if (!response.ok) throw new Error('Authorization could not be verified');
      setAuthorized(true);
    } finally { setBusy(false); }
  };

  return <div className="merchant-access"><DynamicWidget />{!authorized && <button onClick={authorize} disabled={busy}>{busy ? 'Signing…' : 'Authorize mandate'}</button>}{authorized && <span>Mandate authorized</span>}</div>;
}
