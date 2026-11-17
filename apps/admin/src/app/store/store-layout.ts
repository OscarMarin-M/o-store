import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  effect,
  inject,
  input,
} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { StoresService } from '../core/stores.service';

/** Marca la tienda de la URL como activa para que el layout tome su color. */
@Component({
  selector: 'os-store-layout',
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (stores.active(); as store) {
      <router-outlet />
    } @else if (stores.status() === 'ready') {
      <h1>No encontramos esta tienda</h1>
      <p class="os-muted">Puede que se haya borrado o que no tengas acceso. Elige otra en el menú.</p>
    }
  `,
})
export class StoreLayout implements OnDestroy {
  protected readonly stores = inject(StoresService);
  readonly storeId = input.required<string>();

  constructor() {
    effect(() => this.stores.activeId.set(this.storeId()));
  }

  ngOnDestroy(): void {
    this.stores.activeId.set(null);
  }
}
