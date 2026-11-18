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
import { OS_UI } from '../../ui/ui';
import { createDomainSchema, type StoreDomainDto } from '@o-stores/contracts';
import { apiMessage } from '../../core/api-error';
import { AuthService } from '../../core/auth.service';
import { ConfirmService } from '../../core/confirm.service';
import { StoresService } from '../../core/stores.service';
import { DomainsApi } from './domains-api';

@Component({
  selector: 'os-domains-page',
  imports: [FormsModule, MatButtonModule, OS_UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './domains-page.html',
  styleUrl: './domains-page.scss',
})
export class DomainsPage {
  private readonly api = inject(DomainsApi);
  private readonly confirm = inject(ConfirmService);
  protected readonly auth = inject(AuthService);
  private readonly storesService = inject(StoresService);
  protected readonly store = computed(() => this.storesService.active());

  protected readonly domains = signal<StoreDomainDto[]>([]);
  protected readonly status = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly busyId = signal<string | null>(null);
  /** Error o aviso por dominio, junto a su fila. */
  protected readonly rowMessages = signal<Record<string, { kind: 'ok' | 'error'; text: string }>>({});
  protected readonly openInstructions = signal<Set<string>>(new Set());
  protected readonly copied = signal<string | null>(null);

  protected readonly adding = signal(false);
  protected readonly saving = signal(false);
  protected readonly addError = signal<string | null>(null);
  protected newDomain = '';

  /** El subdominio es el principal mientras no haya un dominio propio principal. */
  protected readonly platformIsPrimary = computed(
    () => !this.domains().some((d) => d.isPrimary && d.verified),
  );

  constructor() {
    // Espera a que la tienda esté cargada (hace falta su subdominio) y recarga al cambiar de tienda.
    const storeId = computed(() => this.store()?.id ?? null);
    effect(() => {
      const id = storeId();
      if (id) untracked(() => void this.load(id));
    });
  }

  protected async load(storeId = this.store()?.id): Promise<void> {
    if (!storeId) return;
    this.status.set('loading');
    try {
      const platformDomain = this.store()?.platformDomain;
      // Filas antiguas con el subdominio de la plataforma: ya se muestra arriba.
      const list = await this.api.list(storeId);
      this.domains.set(list.filter((d) => d.domain !== platformDomain));
      this.status.set('ready');
    } catch {
      this.status.set('error');
    }
  }

  protected openForm(): void {
    this.newDomain = '';
    this.addError.set(null);
    this.adding.set(true);
  }

  protected async add(): Promise<void> {
    const store = this.store();
    if (!store) return;
    const raw = this.newDomain.replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
    const parsed = createDomainSchema.shape.domain.safeParse(raw);
    if (!parsed.success) {
      this.addError.set('Escribe solo el dominio, sin https:// ni rutas. Por ejemplo cartastcg.com.bo.');
      return;
    }
    this.saving.set(true);
    this.addError.set(null);
    try {
      const domain = await this.api.add(store.id, parsed.data);
      this.domains.update((list) => [...list, domain]);
      this.openInstructions.update((s) => new Set(s).add(domain.id));
      this.adding.set(false);
    } catch (error) {
      this.addError.set(apiMessage(error, 'No se pudo añadir el dominio. Inténtalo de nuevo.'));
    } finally {
      this.saving.set(false);
    }
  }

  protected toggleInstructions(id: string): void {
    this.openInstructions.update((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  protected check(domain: StoreDomainDto): Promise<void> {
    return this.run(domain, async (storeId) => {
      const updated = await this.api.check(storeId, domain.id);
      this.replace(updated);
      this.openInstructions.update((s) => {
        const next = new Set(s);
        next.delete(domain.id);
        return next;
      });
      return 'Dominio verificado. Ya puedes hacerlo principal.';
    }, 'No se pudo comprobar el dominio. Inténtalo de nuevo.');
  }

  protected markVerified(domain: StoreDomainDto): Promise<void> {
    return this.run(domain, async (storeId) => {
      this.replace(await this.api.update(storeId, domain.id, { verified: true }));
      return 'Marcado como verificado.';
    }, 'No se pudo marcar como verificado.');
  }

  protected makePrimary(domain: StoreDomainDto): Promise<void> {
    return this.run(domain, async (storeId) => {
      await this.api.update(storeId, domain.id, { isPrimary: true });
      await this.load(storeId);
      return 'Ahora es el dominio principal de la tienda.';
    }, 'No se pudo hacer principal.');
  }

  protected async remove(domain: StoreDomainDto): Promise<void> {
    const store = this.store();
    if (!store) return;
    const ok = await this.confirm.ask({
      title: `¿Quitar ${domain.domain}?`,
      message: domain.isPrimary
        ? `Es el dominio principal. La tienda seguirá en ${store.platformDomain}, pero quien entre por ${domain.domain} ya no la verá.`
        : `Quien entre por ${domain.domain} ya no verá la tienda. Puedes volver a añadirlo después.`,
      confirmLabel: 'Quitar dominio',
      destructive: true,
    });
    if (!ok) return;
    await this.run(domain, async (storeId) => {
      await this.api.remove(storeId, domain.id);
      this.domains.update((list) => list.filter((d) => d.id !== domain.id));
      return null;
    }, 'No se pudo quitar el dominio.');
  }

  protected async copy(value: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      this.copied.set(value);
      setTimeout(() => this.copied.update((v) => (v === value ? null : v)), 2000);
    } catch {
      // Sin permiso de portapapeles: el valor sigue visible para copiarlo a mano.
    }
  }

  private async run(
    domain: StoreDomainDto,
    action: (storeId: string) => Promise<string | null>,
    fallback: string,
  ): Promise<void> {
    const store = this.store();
    if (!store || this.busyId()) return;
    this.busyId.set(domain.id);
    this.setRowMessage(domain.id, null);
    try {
      const text = await action(store.id);
      if (text) this.setRowMessage(domain.id, { kind: 'ok', text });
    } catch (error) {
      this.setRowMessage(domain.id, { kind: 'error', text: apiMessage(error, fallback) });
    } finally {
      this.busyId.set(null);
    }
  }

  private replace(domain: StoreDomainDto): void {
    this.domains.update((list) => list.map((d) => (d.id === domain.id ? domain : d)));
  }

  private setRowMessage(id: string, message: { kind: 'ok' | 'error'; text: string } | null): void {
    this.rowMessages.update((m) => {
      const next = { ...m };
      if (message) next[id] = message;
      else delete next[id];
      return next;
    });
  }
}
