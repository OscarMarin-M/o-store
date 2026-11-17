import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Cuenta sin tiendas asignadas (ni super_admin). */
@Component({
  selector: 'os-no-stores',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="os-page-header"><h1>Todavía no tienes tiendas</h1></header>
    <p class="os-muted">
      Cuando el administrador de la plataforma te asigne a una tienda, aparecerá en el menú.
    </p>
  `,
})
export class NoStores {}
