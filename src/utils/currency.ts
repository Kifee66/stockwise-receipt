export function formatKsh(amount: number) {
  try {
    return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", currencyDisplay: "narrowSymbol" }).format(amount);
  } catch {
    // Fallback
    return `KSh ${amount.toFixed(2)}`;
  }
}

export function formatCurrency(amount: number, currency = "KES") {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}
