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
      const challengeResponse = await fetch('/api/merchant/authorization/challenge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address: primaryWallet.address }) });
      if (!challengeResponse.ok) throw new Error('Authorization challenge could not be created');
      const { message, nonce } = await challengeResponse.json() as { message: string; nonce: string };
      const signature = await primaryWallet.signMessage(message);
      if (!signature) throw new Error('The wallet did not return a signature');
      const response = await fetch('/api/merchant/authorization', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address: primaryWallet.address, message, signature, nonce }) });
      if (!response.ok) throw new Error('Authorization could not be verified');
      setAuthorized(true);
    } finally { setBusy(false); }
  };

  return <div className="merchant-access"><DynamicWidget />{!authorized && <button onClick={authorize} disabled={busy}>{busy ? 'Signing…' : 'Sign mandate intent'}</button>}{authorized && <span>Intent verified · onchain mandate pending</span>}</div>;
}
