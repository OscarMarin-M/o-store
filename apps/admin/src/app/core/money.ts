import type { Currency } from '@o-stores/contracts';

const formatters = new Map<Currency, Intl.NumberFormat>();

/** 120 BOB → "Bs 120,00"; 15 USD → "US$ 15,00" (formato boliviano). */
export function formatMoney(amount: number, currency: Currency): string {
  let format = formatters.get(currency);
  if (!format) {
    format = new Intl.NumberFormat('es-BO', { style: 'currency', currency });
    formatters.set(currency, format);
  }
  return format.format(amount);
}

/** Convierte con el tipo oficial (1 USD = rate BOB), redondeando a centavos. */
export function convert(amount: number, from: Currency, to: Currency, rate: number): number {
  if (from === to) return amount;
  const value = from === 'USD' ? amount * rate : amount / rate;
  return Math.round(value * 100) / 100;
}

export const CURRENCY_LABELS: Record<Currency, string> = {
  BOB: 'Bolivianos (Bs)',
  USD: 'Dólares (US$)',
};
