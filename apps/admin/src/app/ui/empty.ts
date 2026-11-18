import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIcon } from '@angular/material/icon';

/**
 * Estado vacío de una lista o sección: dice qué falta y ofrece la acción para empezar.
 *
 *   <os-empty icon="inventory_2" heading="Aún no hay productos en Cartas del Sur">
 *     Crea el primero para que aparezca en la tienda.
 *     <a mat-button osEmptyAction routerLink="nuevo"><mat-icon>add</mat-icon>Crear el primero</a>
 *   </os-empty>
 *
 * Con filtros y sin resultados, la acción es "Quitar filtros" (list.clearFilters()).
 */
@Component({
  selector: 'os-empty',
  imports: [MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'os-empty os-panel', role: 'status' },
  template: `
    <span class="icon" aria-hidden="true"><mat-icon>{{ icon() }}</mat-icon></span>
    <div class="body">
      <p class="heading">{{ heading() }}</p>
      <div class="text"><ng-content /></div>
      <div class="actions"><ng-content select="[osEmptyAction]" /></div>
    </div>
  `,
  styles: `
    :host {
      display: flex;
      align-items: flex-start;
      gap: var(--os-space-4);
      padding: var(--os-space-5);
    }
    .icon {
      display: grid;
      flex: none;
      place-items: center;
      width: 40px;
      height: 40px;
      border-radius: var(--os-radius-field);
      background: color-mix(in srgb, var(--os-store-color-2) 26%, var(--os-color-surface));
      color: var(--os-color-text);
    }
    .body {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: var(--os-space-1);
      min-width: 0;
      max-width: 60ch;
    }
    .heading {
      margin: 0;
      font-weight: 600;
    }
    .text {
      color: var(--os-color-text-muted);
    }
    .text:empty,
    .actions:empty {
      display: none;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--os-space-2);
      margin-top: var(--os-space-2);
      margin-left: calc(-1 * var(--os-space-3)); // alinea el texto del botón plano con el párrafo
    }
  `,
})
export class OsEmpty {
  readonly icon = input.required<string>();
  readonly heading = input.required<string>();
}
