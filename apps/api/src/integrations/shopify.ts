const configured = () => Boolean(process.env.SHOPIFY_SHOP_DOMAIN && process.env.SHOPIFY_ACCESS_TOKEN);

async function graphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const response = await fetch(`https://${process.env.SHOPIFY_SHOP_DOMAIN}/admin/api/${process.env.SHOPIFY_API_VERSION ?? '2026-07'}/graphql.json`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN! },
    body: JSON.stringify({ query, variables }), signal: AbortSignal.timeout(10_000)
  });
  const json = await response.json() as { data?: T; errors?: unknown };
  if (!response.ok || json.errors || !json.data) throw new Error(`Shopify GraphQL request failed: ${response.status}`);
  return json.data;
}

export async function createShopifyFulfilment(input: { shopifyOrderId: string; tracking: string }) {
  if (!configured()) return { mode: 'sandbox' as const, fulfillmentId: `sandbox-fulfillment-${input.shopifyOrderId}` };
  const gid = input.shopifyOrderId.startsWith('gid://') ? input.shopifyOrderId : `gid://shopify/Order/${input.shopifyOrderId}`;
  const found = await graphql<{ order: { fulfillmentOrders: { nodes: Array<{ id: string; status: string }> } } }>(
    `query FulfillmentOrders($id: ID!) { order(id: $id) { fulfillmentOrders(first: 10) { nodes { id status } } } }`, { id: gid }
  );
  const candidate = found.order.fulfillmentOrders.nodes.find((item) => item.status === 'OPEN' || item.status === 'IN_PROGRESS');
  if (!candidate) throw new Error('No fulfillable Shopify fulfillment order found');
  const created = await graphql<{ fulfillmentCreate: { fulfillment: { id: string; status: string } | null; userErrors: Array<{ message: string }> } }>(
    `mutation CreateFulfillment($fulfillment: FulfillmentInput!) { fulfillmentCreate(fulfillment: $fulfillment) { fulfillment { id status } userErrors { message } } }`,
    { fulfillment: { lineItemsByFulfillmentOrder: [{ fulfillmentOrderId: candidate.id }], trackingInfo: { company: 'AfterOrder Sandbox', number: input.tracking } } }
  );
  if (created.fulfillmentCreate.userErrors.length || !created.fulfillmentCreate.fulfillment) throw new Error(created.fulfillmentCreate.userErrors.map((error) => error.message).join('; ') || 'Shopify fulfillment was not created');
  return { mode: 'live' as const, fulfillmentId: created.fulfillmentCreate.fulfillment.id };
}
