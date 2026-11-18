import { ChangeDetectionStrategy, Component, inject, model } from '@angular/core';
import { OsControl, OsField } from './form/field';

const HEX = /^#[0-9a-f]{6}$/;

function normalize(raw: string): string | null {
  const v = raw.trim().toLowerCase();
  const hex = v.startsWith('#') ? v : `#${v}`;
  return HEX.test(hex) ? hex : null;
}

/**
 * Color dentro de un os-field: muestra que abre el selector del sistema y el
 * código hex para escribirlo o pegarlo.
 *
 *   <os-field label="Color principal" [error]="…">
 *     <os-color-input [(value)]="primary" />
 *   </os-field>
 *
 * Un hex mal escrito no cambia el valor: al salir del campo vuelve al último válido.
 */
@Component({
  selector: 'os-color-input',
  imports: [OsControl],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'os-color-input' },
  template: `
    <input
      type="color"
      class="os-color-swatch"
      [value]="value()"
      [attr.aria-label]="'Elegir ' + field.label().toLowerCase()"
      (input)="pick($any($event.target).value)"
    />
    <input
      osControl
      class="os-mono"
      maxlength="7"
      spellcheck="false"
      autocomplete="off"
      [value]="value()"
      (change)="type($event)"
    />
  `,
})
export class OsColorInput {
  readonly value = model.required<string>();
  /** El os-field que lo contiene: da nombre a la muestra para lectores de pantalla. */
  protected readonly field = inject(OsField);

  protected pick(raw: string): void {
    const hex = normalize(raw);
    if (hex) this.value.set(hex);
  }

  protected type(event: Event): void {
    const input = event.target as HTMLInputElement;
    const hex = normalize(input.value);
    if (hex) this.value.set(hex);
    else input.value = this.value();
  }
}
