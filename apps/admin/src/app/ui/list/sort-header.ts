import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import type { ListState } from './list-state';

/**
 * Encabezado de tabla que ordena la lista al pulsarlo.
 * Uso: <th osSort="name" [list]="list">Producto</th>
 */
@Component({
  // Va sobre el <th> nativo para que la tabla siga siendo una tabla accesible.
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'th[osSort]',
  imports: [MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    scope: 'col',
    '[attr.aria-sort]': 'ariaSort()',
    '[class.os-sorted]': 'active()',
  },
  template: `
    <button type="button" class="os-sort" (click)="list().toggleSort(osSort())">
      <ng-content />
      <mat-icon aria-hidden="true">{{ icon() }}</mat-icon>
    </button>
  `,
})
export class OsSortHeader {
  readonly osSort = input.required<string>();
  readonly list = input.required<ListState<string, Record<string, string>>>();

  protected readonly active = computed(() => this.list().sort() === this.osSort());
  protected readonly ariaSort = computed(() =>
    this.active() ? (this.list().dir() === 'asc' ? 'ascending' : 'descending') : 'none',
  );
  protected readonly icon = computed(() =>
    this.active() ? (this.list().dir() === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more',
  );
}
