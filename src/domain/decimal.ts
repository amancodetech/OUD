import Decimal from 'decimal.js';

// Configure Decimal globally for precision 28 and standard commercial rounding
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export { Decimal };

export const MONEY_EPSILON = new Decimal('0.01');
export const QTY_EPSILON = new Decimal('0.000000001'); // 1e-9

export function toDecimal(value: Decimal.Value | null | undefined): Decimal {
  if (value === null || value === undefined) {
    return new Decimal(0);
  }
  if (value instanceof Decimal) {
    return value;
  }
  const str = String(value).trim();
  if (str === '') {
    return new Decimal(0);
  }
  const parsed = new Decimal(str);
  if (!parsed.isFinite()) throw new Error('القيمة الرقمية يجب أن تكون محدودة وصالحة');
  return parsed;
}

export function zero(): Decimal {
  return new Decimal(0);
}

/** Validate an external value before calculations and Decimal(18,4) storage. */
export function toStorageDecimal(value: Decimal.Value | null | undefined): Decimal {
  const decimal = toDecimal(value);
  if (decimal.decimalPlaces() > 4) throw new Error('القيم والكميات تقبل أربع منازل عشرية كحد أقصى');
  if (decimal.abs().gte('100000000000000')) throw new Error('القيمة تتجاوز الحد المسموح للتخزين');
  return decimal;
}

/** Preserve every supported fractional digit in invoices, including 0.0001. */
export function formatInvoiceNumber(value: Decimal.Value | null | undefined, locale: string): string {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-EG-u-nu-latn' : locale === 'id' ? 'id-ID' : 'en-US', {
    maximumFractionDigits: 4,
  }).format(toDecimal(value).toNumber());
}

export function isMoneyZero(d: Decimal): boolean {
  return d.abs().lte(MONEY_EPSILON);
}

export function isQtyZero(d: Decimal): boolean {
  return d.abs().lte(QTY_EPSILON);
}

export function roundMoney(d: Decimal): Decimal {
  return d.toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
}

export function roundQty(d: Decimal): Decimal {
  return d.toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
}

export function formatMoney(val: Decimal.Value, currencyCode: string = 'IDR'): string {
  const d = toDecimal(val);
  if (currencyCode === 'IDR') {
    // In IDR, usually rounded to integer with thousand separators
    const rounded = d.toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
    const parts = rounded.toString().split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  } else {
    // SAR, AED, USD etc: 2 decimal places
    const rounded = d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const parts = rounded.toFixed(2).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  }
}

export function formatQty(val: Decimal.Value, unitName?: string): string {
  const d = toDecimal(val);
  // Remove trailing zeros after decimal point
  const str = d.toDecimalPlaces(4).toString();
  return unitName ? `${str} ${unitName}` : str;
}
