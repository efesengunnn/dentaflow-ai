function formatCurrency(amount: number): string {
  return `${amount.toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} TRY`
}

export { formatCurrency }
