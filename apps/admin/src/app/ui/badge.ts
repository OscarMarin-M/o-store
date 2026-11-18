import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * neutral: estado normal o de reposo (borrador, archivado).
 * store: identidad de la tienda (principal).
 * ok: algo funciona o está publicado. warning: falta una acción de la persona.
 * danger: algo falló o se canceló.
 */
export type BadgeTone = 'neutral' | 'store' | 'ok' | 'warning' | 'danger';

/**
 * Etiqueta de estado: <os-badge tone="ok">Publicado</os-badge>.
 *
 * El texto va siempre en el color normal y el tono solo tiñe el punto y el borde,
 * así se lee bien en ambos temas y no depende solo del color. Para estados de una
 * entidad (pedido, producto, dominio), definir el tono junto a las etiquetas:
 * STATUS_LABELS y STATUS_TONES en el mismo archivo.
 */
@Component({
  selector: 'os-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'os-badge',
    '[attr.data-tone]': 'tone()',
  },
  template: `<span class="dot" aria-hidden="true"></span><ng-content />`,
  styles: `
    :host {
      --tone: var(--os-color-text-muted);
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 1px var(--os-space-2);
      border: 1px solid color-mix(in srgb, var(--tone) 45%, var(--os-color-line));
      border-radius: var(--os-radius-field);
      background: color-mix(in srgb, var(--tone) 8%, transparent);
      color: var(--os-color-text);
      font-size: var(--os-text-sm);
      line-height: 1.5;
      white-space: nowrap;
    }
    :host([data-tone='store']) { --tone: var(--os-store-color); }
    :host([data-tone='ok']) { --tone: var(--os-color-success); }
    :host([data-tone='warning']) { --tone: var(--os-color-accent); }
    :host([data-tone='danger']) { --tone: var(--os-color-danger); }
    .dot {
      flex: none;
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--tone);
    }
  `,
})
export class OsBadge {
  readonly tone = input<BadgeTone>('neutral');
}
