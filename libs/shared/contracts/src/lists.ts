import { z } from 'zod';

/**
 * Listas paginadas: el mismo formato de consulta y de respuesta para productos,
 * pedidos, clientes y cualquier lista larga del admin.
 */

/** Tamaños de página que se pueden pedir; cualquier otro se rechaza. */
export const PAGE_SIZES = [25, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZES)[number];
export const DEFAULT_PAGE_SIZE: PageSize = 50;

export const SORT_DIRS = ['asc', 'desc'] as const;
export type SortDir = (typeof SORT_DIRS)[number];

/** Respuesta de cualquier lista paginada. */
export interface Page<T> {
  items: T[];
  /** Elementos que cumplen los filtros, en todas las páginas. */
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Consulta base de una lista: búsqueda, página, tamaño y orden. Cada lista la
 * extiende con sus filtros (`.extend({ status: ... })`) y declara por qué campos
 * se puede ordenar.
 */
export function listQuerySchema<const S extends readonly [string, ...string[]]>(
  sorts: S,
  defaults: { sort: S[number]; dir: SortDir },
) {
  return z.object({
    q: z.string().trim().max(100).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce
      .number()
      .int()
      .refine((n): n is PageSize => (PAGE_SIZES as readonly number[]).includes(n), {
        message: `Usa uno de estos tamaños: ${PAGE_SIZES.join(', ')}`,
      })
      .default(DEFAULT_PAGE_SIZE),
    sort: z.enum(sorts).default(defaults.sort as never),
    dir: z.enum(SORT_DIRS).default(defaults.dir),
  });
}

/** Última página que existe para un total dado (al menos 1). */
export function lastPage(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}
