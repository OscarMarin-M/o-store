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
import { OS_UI } from '../../ui/ui';
import { ProductsApi } from '../products/products-api';

@Component({
  selector: 'os-settings-page',
  imports: [FormsModule, MatButtonModule, OS_UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="os-page-header">
      <h1>Ajustes</h1>
      <button mat-flat-button class="os-primary" type="button" [disabled]="saving() || state() !== 'ready'" (click)="save()">
        <mat-icon>check</mat-icon>
        {{ saving() ? 'Guardando…' : 'Guardar ajustes' }}
      </button>
    </header>

    @if (message(); as m) {
      <os-notice class="message" [kind]="m.kind">{{ m.text }}</os-notice>
    }

    @switch (state()) {
      @case ('loading') { <p class="os-muted">Cargando ajustes…</p> }
      @case ('error') { <os-notice kind="error">No se pudieron cargar los ajustes. Recarga la página.</os-notice> }
      @default {
        <form class="sections" (ngSubmit)="save()" novalidate>
          <os-form-section heading="Precios" icon="payments" description="Cómo se muestran los importes en la tienda.">
            <os-field
              label="Moneda de la tienda"
              span="half"
              hint="En ella se muestran los totales del carrito. Cada producto puede tener su precio en bolivianos o en dólares."
            >
              <select osControl name="currency" [ngModel]="currency()" (ngModelChange)="currency.set($event)">
                @for (c of currencies; track c) {
                  <option [value]="c">{{ labels[c] }}</option>
                }
              </select>
            </os-field>
          </os-form-section>

          <os-form-section heading="Códigos de producto" icon="qr_code_2" description="El código con el que tus clientes te piden un producto por WhatsApp o en la tienda.">
            <os-field
              label="Prefijo"
              span="third"
              suffix="-0001"
              [hint]="'Ej.: TCG o POL. Los productos nuevos se numeran ' + (prefix() || 'P') + '-0001, ' + (prefix() || 'P') + '-0002… Los que ya existen conservan su código.'"
              [error]="prefixError()"
            >
              <input osControl name="prefix" class="os-mono" maxlength="8" spellcheck="false" autocomplete="off" [ngModel]="prefix()" (ngModelChange)="prefix.set($event.toUpperCase())" />
            </os-field>
          </os-form-section>
        </form>
      }
    }
  `,
  styles: `
    p { margin: 0; }
    .message { margin-bottom: var(--os-space-4); }
    .sections { display: flex; flex-direction: column; gap: var(--os-space-4); max-width: 760px; }
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
