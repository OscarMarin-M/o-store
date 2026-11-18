import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { Router, RouterLink } from '@angular/router';
import { PRODUCT_SORTS, type CategoryDto, type ProductStatus } from '@o-stores/contracts';
import { CategoriesApi, categoryPath, categoryTree } from '../categories/categories-api';
import { formatDay } from '../../core/dates';
import { formatMoney } from '../../core/money';
import { StoresService } from '../../core/stores.service';
import { OS_UI, injectListState, listData } from '../../ui/ui';
import { ProductsApi, STATUS_LABELS } from './products-api';

type Filter = 'current' | ProductStatus;

@Component({
  selector: 'os-products-page',
  imports: [MatButtonModule, RouterLink, OS_UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './products-page.html',
  styleUrl: './products-page.scss',
})
export class ProductsPage {
  private readonly api = inject(ProductsApi);
  private readonly categoriesApi = inject(CategoriesApi);
  private readonly router = inject(Router);
  private readonly stores = inject(StoresService);
  protected readonly store = computed(() => this.stores.active());
  protected readonly statusLabels = STATUS_LABELS;
  protected readonly money = formatMoney;
  protected readonly day = formatDay;

  protected readonly filters: { value: Filter; label: string }[] = [
    { value: 'current', label: 'En uso' },
    { value: 'active', label: 'Publicados' },
    { value: 'draft', label: 'Borradores' },
    { value: 'archived', label: 'Archivados' },
  ];

  /** Búsqueda, filtros, orden y página, guardados en la URL. */
  protected readonly list = injectListState({
    sorts: PRODUCT_SORTS,
    sort: 'updatedAt',
    dir: 'desc',
    // Lo modificado hace poco y lo que tiene más stock, primero.
    firstDir: { updatedAt: 'desc', stock: 'desc' },
    // estado: 'current' = todo menos archivados. categoria: '' = todas, 'none' = sin categoría.
    filters: { estado: 'current' as Filter, categoria: '' },
  });

  protected readonly products = listData(
    () => {
      const id = this.store()?.id;
      if (!id) return undefined;
      const { estado, categoria } = this.list.filters();
      return {
        storeId: id,
        query: {
          q: this.list.q() || undefined,
          status: estado === 'current' ? undefined : estado,
          categoryId: categoria || undefined,
          page: this.list.page(),
          pageSize: this.list.pageSize(),
          sort: this.list.sort(),
          dir: this.list.dir(),
        },
      };
    },
    ({ storeId, query }) => this.api.list(storeId, query),
    { state: this.list },
  );

  protected readonly categories = signal<CategoryDto[]>([]);
  protected readonly categoryTree = computed(() => categoryTree(this.categories()));
  protected readonly categoryName = (id: string | null) => categoryPath(this.categories(), id);

  constructor() {
    const storeId = computed(() => this.store()?.id ?? null);
    effect(() => {
      const id = storeId();
      if (id) untracked(() => void this.loadCategories(id));
    });
  }

  protected open(id: string): void {
    void this.router.navigate(['/tienda', this.store()?.id, 'productos', id]);
  }

  private async loadCategories(storeId: string): Promise<void> {
    try {
      const list = await this.categoriesApi.list(storeId);
      this.categories.set(list);
      // Un filtro de otra tienda (al cambiar de tienda) no tiene sentido aquí.
      const current = this.list.filters().categoria;
      if (current && current !== 'none' && !list.some((c) => c.id === current)) {
        this.list.set({ filters: { categoria: '' } }, { replaceUrl: true });
      }
    } catch {
      // Sin categorías la lista sigue sirviendo; solo falta el filtro.
      this.categories.set([]);
    }
  }
}
