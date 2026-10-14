export const PARTNERS = [
  { name: 'Monad', logo: '/logos/monad.png', role: 'Mandate + escrow contracts on testnet' },
  { name: 'Shopify', logo: '/logos/shopify.svg', role: 'Signed paid-order webhook + fulfilment' },
  { name: 'Dynamic', logo: '/logos/dynamic.png', role: 'Merchant wallet login + mandate signing' },
  { name: 'MetaMask', logo: '/logos/metamask.png', role: 'Merchant signs onchain authority' },
  { name: 'OpenRouter', logo: '/logos/openrouter.svg', role: 'LLM routing for the manager agent' },
  { name: 'Gemini', logo: '/logos/googlegemini.svg', role: 'Gemini 2.5 Flash Lite planner' },
  { name: 'Envio', logo: '/logos/envio.png', role: 'HyperIndex escrow event indexer' },
] as const;

export function PartnerLogo({ name, size = 18 }: { name: (typeof PARTNERS)[number]['name']; size?: number }) {
  const partner = PARTNERS.find((item) => item.name === name)!;
  return <img className="partner-logo" src={partner.logo} alt={`${name} logo`} width={size} height={size} />;
}

export function PartnerStrip({ withRoles = false }: { withRoles?: boolean }) {
  return <div className={`partner-strip ${withRoles ? 'with-roles' : ''}`}>
    {PARTNERS.map((item) => <div key={item.name} className="partner-chip"><PartnerLogo name={item.name} size={withRoles ? 26 : 18}/><div><b>{item.name}</b>{withRoles && <small>{item.role}</small>}</div></div>)}
  </div>;
}
