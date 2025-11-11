// src/lib/money.ts
export function formatMoney(value: number, currency = 'PLN', locale?: string) {
  // prosta heurystyka locale: dla PLN -> pl-PL, EUR/USD -> en-GB
  const loc = locale ?? (currency === 'PLN' ? 'pl-PL' : 'en-GB');
  return new Intl.NumberFormat(loc, { style: 'currency', currency }).format(value || 0);
}
