import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { CURRENCIES, updateStoreSettingsSchema, type Currency } from '@o-stores/contracts';
import { apiMessage } from '../../core/api-error';
import { CURRENCY_LABELS } from '../../core/money';
import { StoresService } from '../../core/stores.service';
import { ProductsApi } from '../products/products-api';

@Component({
  selector: 'os-settings-page',
  imports: [FormsModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="os-page-header">
      <h1>Ajustes</h1>
      <button mat-flat-button class="os-primary" type="button" [disabled]="saving() || state() !== 'ready'" (click)="save()">
        {{ saving() ? 'Guardando…' : 'Guardar ajustes' }}
      </button>
    </header>

    @if (message(); as m) {
      <p class="message" [class.os-error]="m.kind === 'error'" [class.ok]="m.kind === 'ok'" role="status">{{ m.text }}</p>
    }

    @switch (state()) {
      @case ('loading') { <p class="os-muted">Cargando ajustes…</p> }
      @case ('error') { <p class="os-error">No se pudieron cargar los ajustes. Recarga la página.</p> }
      @default {
        <section class="os-panel block">
          <div class="field">
            <label for="s-currency">Moneda de la tienda</label>
            <select id="s-currency" [ngModel]="currency()" (ngModelChange)="currency.set($event)">
              @for (c of currencies; track c) {
                <option [value]="c">{{ labels[c] }}</option>
              }
            </select>
            <p class="hint">En esta moneda se muestran los totales del carrito. Cada producto puede tener su precio en bolivianos o en dólares.</p>
          </div>
          <div class="field">
            <label for="s-prefix">Prefijo de los códigos</label>
            <input id="s-prefix" class="os-mono" maxlength="8" spellcheck="false" [ngModel]="prefix()" (ngModelChange)="prefix.set($event.toUpperCase())" [attr.aria-invalid]="!!prefixError()" />
            @if (prefixError(); as e) {
              <p class="field-error">{{ e }}</p>
            } @else {
              <p class="hint">Los productos nuevos se numeran como {{ prefix() || 'P' }}-0001. Los que ya existen conservan su código.</p>
            }
          </div>
        </section>
      }
    }
  `,
  styles: `
    p { margin: 0; }
    .message { margin-bottom: var(--os-space-4); }
    .ok { color: var(--os-color-success); }
    .block { display: flex; flex-direction: column; gap: var(--os-space-5); max-width: 560px; padding: var(--os-space-5); }
    .field { display: flex; flex-direction: column; gap: var(--os-space-1); }
    label { font-weight: 600; font-size: var(--os-text-sm); }
    input, select {
      max-width: 280px; padding: 8px var(--os-space-3); border: 1px solid var(--os-color-line);
      border-radius: var(--os-radius-field); background: var(--os-color-bg); color: inherit; font: inherit;
    }
    input[aria-invalid='true'] { border-color: var(--os-color-danger); }
    .hint { color: var(--os-color-text-muted); font-size: var(--os-text-sm); max-width: 60ch; }
    .field-error { color: var(--os-color-danger); font-size: var(--os-text-sm); }
  `,
})
export class SettingsPage {
  private readonly api = inject(ProductsApi);
  private readonly stores = inject(StoresService);

  protected readonly currencies = CURRENCIES;
  protected readonly labels = CURRENCY_LABELS;
  protected readonly currency = signal<Currency>('BOB');
  protected readonly prefix = signal('');
  protected readonly prefixError = signal<string | null>(null);
  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly saving = signal(false);
  protected readonly message = signal<{ kind: 'ok' | 'error'; text: string } | null>(null);

  constructor() {
    const storeId = computed(() => this.stores.active()?.id ?? null);
    effect(() => {
      const id = storeId();
      if (id) untracked(() => void this.load(id));
    });
  }

  protected async save(): Promise<void> {
    const id = this.stores.active()?.id;
    if (!id) return;
    const parsed = updateStoreSettingsSchema.safeParse({ currency: this.currency(), productCodePrefix: this.prefix() });
    if (!parsed.success) {
      this.prefixError.set(parsed.error.issues[0]?.message ?? 'Revisa el prefijo.');
      return;
    }
    this.prefixError.set(null);
    this.saving.set(true);
    try {
      const s = await this.api.updateSettings(id, parsed.data);
      this.currency.set(s.currency);
      this.prefix.set(s.productCodePrefix);
      this.message.set({ kind: 'ok', text: 'Ajustes guardados.' });
    } catch (error) {
      this.message.set({ kind: 'error', text: apiMessage(error, 'No se pudieron guardar los ajustes.') });
    } finally {
      this.saving.set(false);
    }
  }

  private async load(storeId: string): Promise<void> {
    this.state.set('loading');
    try {
      const s = await this.api.settings(storeId);
      this.currency.set(s.currency);
      this.prefix.set(s.productCodePrefix);
      this.state.set('ready');
    } catch {
      this.state.set('error');
    }
  }
}
