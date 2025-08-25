export function formatKsh(amount: number) {
  try {
    return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", currencyDisplay: "narrowSymbol" }).format(amount);
  } catch {
    // Fallback
    return `KSh ${amount.toFixed(2)}`;
  }
}
