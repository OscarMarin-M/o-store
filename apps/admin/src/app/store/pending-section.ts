import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { StoresService } from '../core/stores.service';

/** Sección de tienda que aún no está construida. */
@Component({
  selector: 'os-pending-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="os-page-header"><h1>{{ title() }}</h1></header>
    <p class="os-muted">
      Esta sección de {{ stores.active()?.name }} todavía no está lista. La construimos en los próximos pasos.
    </p>
  `,
})
export class PendingSection {
  protected readonly stores = inject(StoresService);
  readonly title = input('');
}
