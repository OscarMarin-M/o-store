import type { Page } from '@o-stores/contracts';
import type { SelectQueryBuilder } from 'kysely';

export interface PageRequest {
  page: number;
  pageSize: number;
}

/**
 * Cuenta y trae una página de la misma consulta filtrada.
 *
 * - `base` lleva solo los filtros (where), sin columnas ni orden.
 * - `rows` añade columnas y orden. El orden debe terminar en una columna única
 *   (p. ej. el id): si dos filas empatan, sin desempate Postgres puede devolverlas
 *   en distinto orden en cada página y un elemento saldría repetido o se perdería.
 *
 * El conteo y la página van en paralelo. Con decenas de miles de filas el conteo
 * exacto empieza a costar; entonces convendrá cachearlo o estimarlo.
 */
export async function paginate<DB, TB extends keyof DB, B, O, T>(
  base: SelectQueryBuilder<DB, TB, B>,
  rows: (qb: SelectQueryBuilder<DB, TB, B>) => SelectQueryBuilder<DB, TB, O>,
  req: PageRequest,
  map: (row: O) => T,
): Promise<Page<T>> {
  const [count, items] = await Promise.all([
    base.select((eb) => eb.fn.countAll<string>().as('total')).executeTakeFirstOrThrow(),
    rows(base)
      .limit(req.pageSize)
      .offset((req.page - 1) * req.pageSize)
      .execute(),
  ]);
  return {
    items: items.map(map),
    total: Number((count as { total: string }).total),
    page: req.page,
    pageSize: req.pageSize,
  };
}
