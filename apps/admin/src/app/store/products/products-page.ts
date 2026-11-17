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
import type { ProductListDto, ProductStatus } from '@o-stores/contracts';
import { formatMoney } from '../../core/money';
import { StoresService } from '../../core/stores.service';
import { ProductsApi, STATUS_LABELS } from './products-api';

type Filter = 'current' | ProductStatus;

@Component({
  selector: 'os-products-page',
  imports: [MatButtonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './products-page.html',
  styleUrl: './products-page.scss',
})
export class ProductsPage {
  private readonly api = inject(ProductsApi);
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
  protected readonly page = signal(1);
  protected readonly data = signal<ProductListDto | null>(null);
  protected readonly status = signal<'loading' | 'ready' | 'error'>('loading');

  protected readonly pages = computed(() => {
    const d = this.data();
    return d ? Math.max(1, Math.ceil(d.total / d.pageSize)) : 1;
  });

  private searchTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    const storeId = computed(() => this.store()?.id ?? null);
    effect(() => {
      const id = storeId();
      const filter = this.filter();
      const page = this.page();
      const q = this.search();
      if (id) untracked(() => void this.load(id, filter, page, q));
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
    if (id) void this.load(id, this.filter(), this.page(), this.search());
  }

  private async load(storeId: string, filter: Filter, page: number, q: string): Promise<void> {
    this.status.set('loading');
    try {
      this.data.set(
        await this.api.list(storeId, {
          q: q || undefined,
          status: filter === 'current' ? undefined : filter,
          page,
        }),
      );
      this.status.set('ready');
    } catch {
      this.status.set('error');
    }
  }
}
