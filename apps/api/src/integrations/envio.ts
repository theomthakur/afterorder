const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function verifyIndexedRelease(orderKey: string, expectedTxHash: string, options: { attempts?: number; delayMs?: number } = {}) {
  if (!process.env.ENVIO_GRAPHQL_URL) return { mode: 'sandbox' as const, verified: false, status: 'not_configured' as const };
  const attempts = options.attempts ?? 3;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (process.env.ENVIO_API_TOKEN) headers.Authorization = `Bearer ${process.env.ENVIO_API_TOKEN}`;
  let reason = 'Envio has not indexed the release yet';
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(process.env.ENVIO_GRAPHQL_URL, {
        method: 'POST', headers, signal: AbortSignal.timeout(8_000),
        body: JSON.stringify({
          query: `query ReleasedOrder($orderId: String!) { OrderRelease(where: { orderId: { _eq: $orderId } }, limit: 1) { orderId transactionHash supplier amount } }`,
          variables: { orderId: orderKey.toLowerCase() }
        })
      });
      const body = await response.json() as { data?: { OrderRelease?: Array<{ orderId: string; transactionHash: string }> }; errors?: unknown };
      if (!response.ok || body.errors) reason = 'Envio query failed and will be reconciled later';
      else {
        const release = body.data?.OrderRelease?.[0];
        if (release?.transactionHash.toLowerCase() === expectedTxHash.toLowerCase()) {
          return { mode: 'live' as const, verified: true, status: 'indexed' as const, attempts: attempt };
        }
        if (release) return { mode: 'live' as const, verified: false, status: 'mismatch' as const, attempts: attempt, reason: 'Envio returned a different release transaction' };
      }
    } catch (error) {
      reason = error instanceof Error ? error.message : 'Envio query failed and will be reconciled later';
    }
    if (attempt < attempts) await wait((options.delayMs ?? 250) * 2 ** (attempt - 1));
  }
  return { mode: 'live' as const, verified: false, status: 'pending' as const, attempts, reason };
}
