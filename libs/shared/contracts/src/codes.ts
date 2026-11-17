/** Texto a código: "Negro Mate" → "NEGROMATE", "Talla 2XL" → "TALLA2XL". */
export function codePart(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12);
}

/** Código público de un producto: TCG + 12 → "TCG-0012". */
export function productCode(prefix: string, n: number | string): string {
  return `${prefix}-${String(n).padStart(4, '0')}`;
}

/** Código de una variante: "TCG-0012" + ["M", "Negro"] → "TCG-0012-M-NEGRO". */
export function variantCode(productCode: string, optionValues: string[]): string {
  const parts = optionValues.map(codePart).filter(Boolean);
  return [productCode, ...parts].join('-').slice(0, 60);
}

/** Dirección de un producto: nombre + código, única porque el código lo es. */
export function productSlug(name: string, code: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return [base, code.toLowerCase()].filter(Boolean).join('-');
}
