import {
  ChangeDetectionStrategy,
  Component,
  Directive,
  booleanAttribute,
  computed,
  contentChild,
  inject,
  input,
} from '@angular/core';
import { MatIcon } from '@angular/material/icon';

let nextId = 0;

/** Ayuda con marcado propio (un enlace, por ejemplo) dentro de un os-field. */
@Directive({ selector: '[osHint]' })
export class OsHint {}

/** Ancho del campo dentro de la cuadrícula de 6 columnas de os-form-section. */
export type FieldSpan = 'full' | 'two-thirds' | 'half' | 'third';

/**
 * Campo de formulario: etiqueta visible, control, y debajo una ayuda o el error.
 *
 *   <os-field label="Nombre" hint="Ej.: Sobre de Yu-Gi-Oh" [error]="errors()['name']">
 *     <input osControl name="name" [(ngModel)]="name" />
 *   </os-field>
 *
 * La ayuda puede llevar enlaces con un elemento marcado `osHint`.
 */
@Component({
  selector: 'os-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'os-field',
    '[class.os-span-two-thirds]': "span() === 'two-thirds'",
    '[class.os-span-half]': "span() === 'half'",
    '[class.os-span-third]': "span() === 'third'",
    '[class.os-field-invalid]': '!!error()',
    '[class.os-field-label-hidden]': 'labelHidden()',
  },
  imports: [MatIcon],
  template: `
    <label class="os-field-label" [class.visually-hidden]="labelHidden()" [for]="controlId">
      {{ label() }}
      @if (optional()) {
        <span class="os-field-optional">opcional</span>
      }
    </label>
    <div class="os-field-control" [class.os-field-affixed]="!!prefix() || !!suffix() || !!icon()">
      @if (icon(); as i) {
        <mat-icon class="os-field-icon" aria-hidden="true">{{ i }}</mat-icon>
      }
      @if (prefix(); as p) {
        <span class="os-field-affix" aria-hidden="true">{{ p }}</span>
      }
      <ng-content />
      @if (suffix(); as s) {
        <span class="os-field-affix" aria-hidden="true">{{ s }}</span>
      }
    </div>
    @if (error(); as e) {
      <p class="os-field-message os-field-error" [id]="messageId" role="alert">
        <mat-icon aria-hidden="true">error</mat-icon>
        <span>{{ e }}</span>
      </p>
    } @else if (hint() || richHint()) {
      <p class="os-field-message" [id]="messageId">
        {{ hint() }}
        <ng-content select="[osHint]" />
      </p>
    }
  `,
})
export class OsField {
  protected readonly richHint = contentChild(OsHint);
  readonly label = input.required<string>();
  /** Explicación o ejemplo, siempre visible bajo el control salvo cuando hay error. */
  readonly hint = input<string | null | undefined>(null);
  readonly error = input<string | null | undefined>(null);
  readonly optional = input(false, { transform: booleanAttribute });
  readonly span = input<FieldSpan>('full');
  /** Texto fijo pegado al control: "Bs", "US$", "/". */
  readonly prefix = input<string | null>(null);
  readonly suffix = input<string | null>(null);
  /** Icono de Material Symbols dentro del control, a la izquierda: "search", "mail". */
  readonly icon = input<string | null>(null);
  /** Etiqueta solo para lectores de pantalla (barras de búsqueda y filtros). */
  readonly labelHidden = input(false, { transform: booleanAttribute });

  readonly controlId = `os-field-${nextId++}`;
  readonly messageId = `${this.controlId}-msg`;
  readonly hasMessage = computed(() => !!(this.error() || this.hint() || this.richHint()));
}

/** Marca el input, select o textarea de un os-field y lo enlaza con su etiqueta y su mensaje. */
@Directive({
  selector: 'input[osControl], select[osControl], textarea[osControl]',
  host: {
    class: 'os-control',
    '[id]': 'field.controlId',
    '[attr.aria-describedby]': 'field.hasMessage() ? field.messageId : null',
    '[attr.aria-invalid]': "field.error() ? 'true' : null",
  },
})
export class OsControl {
  protected readonly field = inject(OsField);
}

/**
 * Panel de formulario con título, descripción opcional y cuadrícula para los campos.
 * Los botones van en un pie con `<div osFormActions class="os-form-actions">`.
 */
@Component({
  selector: 'os-form-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'os-panel os-form-section', role: 'group', '[attr.aria-labelledby]': 'headingId' },
  imports: [MatIcon],
  template: `
    <header class="os-form-section-header" [class.os-form-section-header-icon]="!!icon()">
      @if (icon(); as i) {
        <span class="os-form-section-icon" aria-hidden="true"><mat-icon>{{ i }}</mat-icon></span>
      }
      <h2 [id]="headingId">{{ heading() }}</h2>
      @if (description(); as d) {
        <p>{{ d }}</p>
      }
    </header>
    <div class="os-form-grid">
      <ng-content />
    </div>
    <ng-content select="[osFormActions]" />
  `,
})
export class OsFormSection {
  readonly heading = input.required<string>();
  readonly description = input<string | null>(null);
  /** Icono de Material Symbols que identifica la sección: "sell", "payments". */
  readonly icon = input<string | null>(null);
  readonly headingId = `os-section-${nextId++}`;
}

/** Todo lo necesario para escribir formularios: importar esto en el componente. */
export const OS_FORM = [OsField, OsControl, OsHint, OsFormSection] as const;
