import { PRICING } from './constants.js';

const formatters = new Map<string, Intl.NumberFormat>();

function formatterFor(currency: string, fractionDigits: number): Intl.NumberFormat {
  const key = `${currency}:${String(fractionDigits)}`;
  const cached = formatters.get(key);
  if (cached !== undefined) {
    return cached;
  }

  const formatter = new Intl.NumberFormat('en-IN', {
    currency,
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
    style: 'currency',
  });
  formatters.set(key, formatter);
  return formatter;
}

/** Formats an amount stored in minor units (paise) for display. */
export function formatMoney(
  amountInMinorUnits: number,
  currency: string = PRICING.currency,
): string {
  const hasFraction = amountInMinorUnits % 100 !== 0;
  return formatterFor(currency, hasFraction ? 2 : 0).format(amountInMinorUnits / 100);
}

/** Converts a major-unit amount (rupees) to integer minor units (paise). */
export function toMinorUnits(amountInMajorUnits: number): number {
  return Math.round(amountInMajorUnits * 100);
}

/** Converts integer minor units (paise) to a major-unit amount (rupees). */
export function toMajorUnits(amountInMinorUnits: number): number {
  return amountInMinorUnits / 100;
}

/** Percentage saved between a compare-at price and the selling price, rounded down. */
export function discountPercent(price: number, compareAtPrice: number | null): number {
  if (compareAtPrice === null || compareAtPrice <= price || compareAtPrice <= 0) {
    return 0;
  }

  return Math.floor(((compareAtPrice - price) / compareAtPrice) * 100);
}
