import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { PAGE_SIZES, lastPage, type Page } from '@o-stores/contracts';
import type { ListState } from './list-state';

const count = new Intl.NumberFormat('es-BO');

/**
 * Pie de una lista paginada: "1–50 de 312", tamaño de página y anterior/siguiente.
 * Uso: <os-pager [list]="list" [data]="data" noun="productos" />
 */
@Component({
  selector: 'os-pager',
  imports: [MatButtonModule, MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let d = data();
    <nav class="os-pager" aria-label="Páginas">
      <span class="os-pager-range" aria-live="polite">{{ range() }}</span>
      <label class="os-pager-size">
        <span>Por página</span>
        <select class="os-control" [value]="d.pageSize" (change)="list().set({ pageSize: +$any($event.target).value })">
          @for (size of sizes; track size) {
            <option [value]="size" [selected]="size === d.pageSize">{{ size }}</option>
          }
        </select>
      </label>
      @if (pages() > 1) {
        <div class="os-pager-steps">
          <button mat-button type="button" [disabled]="d.page <= 1" (click)="go(d.page - 1)">
            <mat-icon>chevron_left</mat-icon>Anterior
          </button>
          <span class="os-muted">Página {{ d.page }} de {{ pages() }}</span>
          <button mat-button type="button" class="os-pager-next" [disabled]="d.page >= pages()" (click)="go(d.page + 1)">
            Siguiente<mat-icon iconPositionEnd>chevron_right</mat-icon>
          </button>
        </div>
      }
    </nav>
  `,
})
export class OsPager {
  readonly list = input.required<ListState<string, Record<string, string>>>();
  readonly data = input.required<Page<unknown>>();
  /** Qué se cuenta, en plural: "productos", "pedidos". */
  readonly noun = input('elementos');

  protected readonly sizes = PAGE_SIZES;
  protected readonly pages = computed(() => lastPage(this.data().total, this.data().pageSize));
  protected readonly range = computed(() => {
    const { page, pageSize, total, items } = this.data();
    if (!total) return `0 ${this.noun()}`;
    const from = (page - 1) * pageSize + 1;
    const to = from + items.length - 1;
    return `${count.format(from)}–${count.format(to)} de ${count.format(total)} ${this.noun()}`;
  });

  protected go(page: number): void {
    this.list().set({ page });
    // Al cambiar de página, volver arriba de la lista y no quedarse en el pie.
    window.scrollTo({ top: 0 });
  }
}
