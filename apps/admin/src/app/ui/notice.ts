import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIcon } from '@angular/material/icon';

export type NoticeKind = 'ok' | 'error' | 'info' | 'warning';

const ICONS: Record<NoticeKind, string> = {
  ok: 'check_circle',
  error: 'error',
  info: 'info',
  warning: 'warning',
};

/**
 * Aviso de una pantalla: resultado de guardar, error o información.
 *
 *   <os-notice kind="ok">Ajustes guardados.</os-notice>
 *
 * Los errores se anuncian al momento a los lectores de pantalla (role="alert");
 * el resto, de forma educada (role="status").
 */
@Component({
  selector: 'os-notice',
  imports: [MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'os-notice',
    '[class.os-notice-ok]': "kind() === 'ok'",
    '[class.os-notice-error]': "kind() === 'error'",
    '[class.os-notice-warning]': "kind() === 'warning'",
    '[attr.role]': "kind() === 'error' ? 'alert' : 'status'",
  },
  template: `
    <mat-icon aria-hidden="true">{{ icon() }}</mat-icon>
    <div class="os-notice-body"><ng-content /></div>
  `,
  styles: `
    :host {
      display: flex;
      align-items: flex-start;
      gap: var(--os-space-2);
      max-width: 860px;
      padding: var(--os-space-2) var(--os-space-3);
      border: 1px solid var(--os-color-line);
      border-left: 3px solid var(--tone);
      border-radius: var(--os-radius-field);
      background: var(--os-color-surface);
      --tone: var(--os-color-text-muted);
    }
    :host(.os-notice-ok) { --tone: var(--os-color-success); }
    :host(.os-notice-error) { --tone: var(--os-color-danger); }
    :host(.os-notice-warning) { --tone: var(--os-color-accent); }
    mat-icon { flex: none; color: var(--tone); }
    .os-notice-body { min-width: 0; padding-top: 1px; }
  `,
})
export class OsNotice {
  readonly kind = input<NoticeKind>('info');
  protected readonly icon = computed(() => ICONS[this.kind()]);
}
