function pgCode(error: unknown): unknown {
  return typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : undefined;
}

/** Postgres 23505: se violó una restricción de unicidad. */
export function isUniqueViolation(error: unknown): boolean {
  return pgCode(error) === '23505';
}

/** Postgres 23503: la fila referida (p. ej. la categoría) no existe. */
export function isForeignKeyViolation(error: unknown): boolean {
  return pgCode(error) === '23503';
}
