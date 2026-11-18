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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { CategoryDto, ProductListDto, ProductStatus } from '@o-stores/contracts';
import { CategoriesApi, categoryPath, categoryTree } from '../categories/categories-api';
import { formatMoney } from '../../core/money';
import { StoresService } from '../../core/stores.service';
import { OS_UI } from '../../ui/ui';
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

  protected readonly filters: { value: Filter; label: string }[] = [
    { value: 'current', label: 'En uso' },
    { value: 'active', label: 'Publicados' },
    { value: 'draft', label: 'Borradores' },
    { value: 'archived', label: 'Archivados' },
  ];

  protected readonly filter = signal<Filter>('current');
  protected readonly search = signal('');
  /** '' = todas, 'none' = sin categoría, o el id de una categoría. */
  protected readonly category = signal<string>(
    inject(ActivatedRoute).snapshot.queryParamMap.get('categoria') ?? '',
  );
  protected readonly page = signal(1);
  protected readonly data = signal<ProductListDto | null>(null);
  protected readonly status = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly categories = signal<CategoryDto[]>([]);
  protected readonly categoryTree = computed(() => categoryTree(this.categories()));
  protected readonly categoryName = (id: string | null) => categoryPath(this.categories(), id);

  protected readonly pages = computed(() => {
    const d = this.data();
    return d ? Math.max(1, Math.ceil(d.total / d.pageSize)) : 1;
  });

  private searchTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    const storeId = computed(() => this.store()?.id ?? null);
    effect(() => {
      const id = storeId();
      if (id) untracked(() => void this.loadCategories(id));
    });
    effect(() => {
      const id = storeId();
      const filter = this.filter();
      const page = this.page();
      const q = this.search();
      const category = this.category();
      if (id) untracked(() => void this.load(id, filter, page, q, category));
    });
  }

  protected setCategory(value: string): void {
    this.page.set(1);
    this.category.set(value);
    // En la dirección, para que recargar o compartir el enlace conserve el filtro.
    void this.router.navigate([], {
      queryParams: { categoria: value || null },
      replaceUrl: true,
    });
  }

  protected onSearch(value: string): void {
    clearTimeout(this.searchTimer);
    // Espera a que dejes de escribir para no pedir la lista en cada tecla.
    this.searchTimer = setTimeout(() => {
      this.page.set(1);
      this.search.set(value.trim());
    }, 300);
  }

  protected setFilter(value: Filter): void {
    this.page.set(1);
    this.filter.set(value);
  }

  protected open(id: string): void {
    void this.router.navigate(['/tienda', this.store()?.id, 'productos', id]);
  }

  protected retry(): void {
    const id = this.store()?.id;
    if (id) void this.load(id, this.filter(), this.page(), this.search(), this.category());
  }

  private async loadCategories(storeId: string): Promise<void> {
    try {
      const list = await this.categoriesApi.list(storeId);
      this.categories.set(list);
      // Un filtro de otra tienda (al cambiar de tienda) no tiene sentido aquí.
      const current = this.category();
      if (current && current !== 'none' && !list.some((c) => c.id === current)) {
        this.setCategory('');
      }
    } catch {
      // Sin categorías la lista sigue sirviendo; solo falta el filtro.
      this.categories.set([]);
    }
  }

  private async load(storeId: string, filter: Filter, page: number, q: string, category: string): Promise<void> {
    this.status.set('loading');
    try {
      this.data.set(
        await this.api.list(storeId, {
          q: q || undefined,
          status: filter === 'current' ? undefined : filter,
          categoryId: category || undefined,
          page,
        }),
      );
      this.status.set('ready');
    } catch {
      this.status.set('error');
    }
  }
}
