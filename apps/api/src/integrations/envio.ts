export async function verifyIndexedRelease(orderKey: string, expectedTxHash: string) {
  if (!process.env.ENVIO_GRAPHQL_URL) return { mode: 'sandbox' as const, verified: false };
  const response = await fetch(process.env.ENVIO_GRAPHQL_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(8_000),
    body: JSON.stringify({
      query: `query ReleasedOrder($orderId: String!) { OrderRelease(where: { orderId: { _eq: $orderId } }, limit: 1) { orderId transactionHash supplier amount } }`,
      variables: { orderId: orderKey.toLowerCase() }
    })
  });
  const body = await response.json() as { data?: { OrderRelease?: Array<{ orderId: string; transactionHash: string }> }; errors?: unknown };
  if (!response.ok || body.errors) throw new Error('Envio could not confirm the release event');
  const release = body.data?.OrderRelease?.[0];
  if (!release || release.transactionHash.toLowerCase() !== expectedTxHash.toLowerCase()) throw new Error('Envio release record does not match the submitted transaction');
  return { mode: 'live' as const, verified: true };
}
