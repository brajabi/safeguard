export const APP_CATALOG: Array<{ id: string; name: string }> = [
  { id: "paypal", name: "PayPal" },
  { id: "revolut", name: "Revolut" },
  { id: "n26", name: "N26" },
  { id: "wise", name: "Wise" },
  { id: "binance", name: "Binance" },
  { id: "bybit", name: "Bybit" },
  { id: "wirex", name: "Wirex" },
  { id: "redotpay", name: "RedotPay" },
  { id: "custom", name: "Custom" },
];

export function appCatalogId(name: string): string {
  const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  const aliases: Record<string, string> = {
    revloute: "revolut",
    revolute: "revolut",
    binnace: "binance",
    transferwise: "wise",
  };
  const id = aliases[normalized] ?? normalized;
  return APP_CATALOG.some((app) => app.id === id) ? id : "custom";
}
