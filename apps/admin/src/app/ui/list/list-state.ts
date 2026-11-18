import { computed, effect, inject, signal, untracked, type Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, type ParamMap } from '@angular/router';
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZES,
  lastPage,
  type Page,
  type PageSize,
  type SortDir,
} from '@o-stores/contracts';

/** Nombres de los parÃ¡metros comunes en la URL (los filtros usan los suyos). */
const KEYS = { q: 'buscar', page: 'pagina', pageSize: 'por_pagina', sort: 'orden', dir: 'dir' } as const;

export interface ListStateConfig<S extends string, F extends Record<string, string>> {
  /** Campos por los que se puede ordenar (los mismos que acepta la API). */
  sorts: readonly S[];
  sort: S;
  dir: SortDir;
  /** Sentido del primer clic en cada columna; por defecto ascendente. */
  firstDir?: Partial<Record<S, SortDir>>;
  /** Filtros propios: nombre en la URL -> valor por defecto ('' = sin filtro). */
  filters: F;
}

interface Patch<S, F> {
  q?: string;
  page?: number;
  pageSize?: number;
  sort?: S;
  dir?: SortDir;
  filters?: Partial<F>;
}

/**
 * Estado de una lista (bÃºsqueda, filtros, orden, pÃ¡gina) guardado en la URL.
 * La URL es la Ãºnica fuente de verdad: los cambios navegan y las seÃ±ales la leen,
 * asÃ­ recargar, compartir el enlace o volver atrÃ¡s conserva la vista.
 */
export class ListState<S extends string, F extends Record<string, string>> {
  private readonly params: Signal<ParamMap>;
  private searchTimer: ReturnType<typeof setTimeout> | undefined;

  readonly q: Signal<string>;
  readonly page: Signal<number>;
  readonly pageSize: Signal<PageSize>;
  readonly sort: Signal<S>;
  readonly dir: Signal<SortDir>;
  readonly filters: Signal<F>;
  /** Hay bÃºsqueda o algÃºn filtro distinto del de por defecto. */
  readonly filtered: Signal<boolean>;

  constructor(
    private readonly config: ListStateConfig<S, F>,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
  ) {
    this.params = toSignal(route.queryParamMap, { initialValue: route.snapshot.queryParamMap });
    const get = (key: string) => this.params().get(key);

    this.q = computed(() => get(KEYS.q)?.trim() ?? '');
    this.page = computed(() => {
      const n = Number(get(KEYS.page));
      return Number.isInteger(n) && n >= 1 ? n : 1;
    });
    this.pageSize = computed(() => {
      const n = Number(get(KEYS.pageSize));
      return (PAGE_SIZES as readonly number[]).includes(n) ? (n as PageSize) : DEFAULT_PAGE_SIZE;
    });
    this.sort = computed(() => {
      const s = get(KEYS.sort) as S | null;
      return s && config.sorts.includes(s) ? s : config.sort;
    });
    this.dir = computed(() => {
      const d = get(KEYS.dir);
      return d === 'asc' || d === 'desc' ? d : config.dir;
    });
    this.filters = computed(() => {
      const out = { ...config.filters };
      for (const key of Object.keys(out) as (keyof F & string)[]) {
        const value = get(key);
        if (value !== null) out[key] = value as F[typeof key];
      }
      return out;
    });
    this.filtered = computed(
      () =>
        !!this.q() ||
        Object.entries(this.filters()).some(([key, value]) => value !== config.filters[key]),
    );
  }

  /** Cambia la vista. Cualquier cambio salvo el de pÃ¡gina vuelve a la pÃ¡gina 1. */
  set(patch: Patch<S, F>, options: { replaceUrl?: boolean } = {}): void {
    const c = this.config;
    // null quita el parÃ¡metro: los valores por defecto no ensucian la URL.
    const orNull = <V>(value: V | undefined, fallback: V) =>
      value === undefined ? undefined : value === fallback || value === '' ? null : value;

    const queryParams: Record<string, string | number | null | undefined> = {
      [KEYS.q]: orNull(patch.q?.trim(), ''),
      [KEYS.pageSize]: orNull(patch.pageSize, DEFAULT_PAGE_SIZE),
      [KEYS.sort]: orNull(patch.sort, c.sort),
      [KEYS.dir]: orNull(patch.dir, c.dir),
      [KEYS.page]: patch.page === undefined ? null : orNull(patch.page, 1),
    };
    for (const [key, value] of Object.entries(patch.filters ?? {})) {
      queryParams[key] = orNull(value as string, c.filters[key]);
    }
    for (const key of Object.keys(queryParams)) {
      if (queryParams[key] === undefined) delete queryParams[key];
    }

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
      replaceUrl: options.replaceUrl,
    });
  }

  setFilter<K extends keyof F>(key: K, value: F[K]): void {
    this.set({ filters: { [key]: value } as unknown as Partial<F> });
  }

  /** BÃºsqueda mientras se escribe: espera a que dejes de teclear y no llena el historial. */
  search(value: string): void {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.set({ q: value }, { replaceUrl: true }), 300);
  }

  /** Clic en un encabezado: la misma columna invierte el sentido; otra empieza por el suyo. */
  toggleSort(field: S): void {
    if (this.sort() === field) {
      this.set({ sort: field, dir: this.dir() === 'asc' ? 'desc' : 'asc' });
    } else {
      this.set({ sort: field, dir: this.config.firstDir?.[field] ?? 'asc' });
    }
  }

  /** Quita bÃºsqueda y filtros, conservando orden y tamaÃ±o de pÃ¡gina. */
  clearFilters(): void {
    clearTimeout(this.searchTimer);
    this.set({ q: '', filters: { ...this.config.filters } });
  }
}

/** Crea el estado de una lista ligado a la URL de la ruta actual. */
export function injectListState<S extends string, F extends Record<string, string>>(
  config: ListStateConfig<S, F>,
): ListState<S, F> {
  return new ListState(config, inject(Router), inject(ActivatedRoute));
}

export interface ListData<T> {
  data: Signal<Page<T> | null>;
  status: Signal<'loading' | 'ready' | 'error'>;
  reload(): void;
}

/**
 * Carga una lista cada vez que cambia lo que lee `request` (devolver undefined
 * espera, p. ej. sin tienda activa). Solo la Ãºltima peticiÃ³n cuenta: si escribes
 * rÃ¡pido, una respuesta lenta anterior no pisa la nueva. Mientras carga se
 * conserva la pÃ¡gina anterior, para que la tabla no parpadee.
 */
export function listData<R, T>(
  request: () => R | undefined,
  loader: (request: R) => Promise<Page<T>>,
  options: { state?: ListState<string, Record<string, string>> } = {},
): ListData<T> {
  const data = signal<Page<T> | null>(null);
  const status = signal<'loading' | 'ready' | 'error'>('loading');
  let latest = 0;

  const run = (req: R) => {
    const id = ++latest;
    status.set('loading');
    loader(req).then(
      (page) => {
        if (id !== latest) return;
        // Una pÃ¡gina que ya no existe (p. ej. tras archivar) lleva a la Ãºltima.
        const last = lastPage(page.total, page.pageSize);
        if (options.state && page.page > last) {
          options.state.set({ page: last }, { replaceUrl: true });
          return;
        }
        data.set(page);
        status.set('ready');
      },
      () => {
        if (id === latest) status.set('error');
      },
    );
  };

  effect(() => {
    const req = request();
    if (req !== undefined) untracked(() => run(req));
  });

  return {
    data: data.asReadonly(),
    status: status.asReadonly(),
    reload: () => {
      const req = untracked(request);
      if (req !== undefined) run(req);
    },
  };
}
