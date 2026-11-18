import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MatSlideToggleModule,
  type MatSlideToggleChange,
} from '@angular/material/slide-toggle';
import { RouterLink } from '@angular/router';
import {
  STORE_MODULES,
  DEFAULT_STORE_PRIMARY,
  createStoreSchema,
  reservedColorIssue,
  similarShade,
  slugify,
  type StoreDto,
  type StoreModule,
} from '@o-stores/contracts';
import { apiFields, apiMessage, formErrors } from '../core/api-error';
import { ConfirmService } from '../core/confirm.service';
import { StoresService } from '../core/stores.service';
import { OS_UI } from '../ui/ui';

const MODULE_LABELS: Record<StoreModule, string> = {
  tcg: 'Cartas TCG',
  apparel: 'Poleras personalizadas',
};

const MODULE_HINTS: Record<StoreModule, string> = {
  tcg: 'Datos de carta: edición, rareza, estado e idioma.',
  apparel: 'Tallas, colores y diseños que sube el cliente.',
};

/** Campos del formulario de creación que muestran su propio error. */
const CREATE_FIELDS = ['name', 'slug', 'colorPrimary', 'colorAccent'] as const;

@Component({
  selector: 'os-platform-stores',
  imports: [FormsModule, RouterLink, MatButtonModule, MatSlideToggleModule, OS_UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './platform-stores.html',
  styleUrl: './platform-stores.scss',
})
export class PlatformStores {
  protected readonly stores = inject(StoresService);
  private readonly confirm = inject(ConfirmService);
  protected readonly modules = STORE_MODULES;
  protected readonly moduleLabels = MODULE_LABELS;
  protected readonly moduleHints = MODULE_HINTS;

  protected readonly creating = signal(false);
  protected readonly saving = signal(false);
  protected readonly errors = signal<Partial<Record<(typeof CREATE_FIELDS)[number] | 'form', string>>>({});
  protected readonly toggling = signal<string | null>(null);

  protected name = '';
  protected slug = '';
  protected slugTouched = false;
  protected selected = new Set<StoreModule>();

  // Dos colores parecidos: el secundario sigue al principal hasta que lo cambies a mano.
  protected readonly colorPrimary = signal(DEFAULT_STORE_PRIMARY);
  protected readonly colorAccent = signal(similarShade(DEFAULT_STORE_PRIMARY));
  private accentTouched = false;
  protected readonly primaryIssue = computed(() => reservedColorIssue(this.colorPrimary()));
  protected readonly accentIssue = computed(() => reservedColorIssue(this.colorAccent()));

  protected setPrimary(hex: string): void {
    this.colorPrimary.set(hex);
    if (!this.accentTouched) this.colorAccent.set(similarShade(hex));
    this.errors.update((e) => ({ ...e, colorPrimary: undefined, colorAccent: undefined }));
  }

  protected setAccent(hex: string): void {
    this.accentTouched = true;
    this.colorAccent.set(hex);
    this.errors.update((e) => ({ ...e, colorAccent: undefined }));
  }

  /** Vuelve a calcular el secundario desde el principal. */
  protected matchAccent(): void {
    this.accentTouched = false;
    this.colorAccent.set(similarShade(this.colorPrimary()));
  }

  protected moduleLabel(module: string): string {
    return MODULE_LABELS[module as StoreModule] ?? module;
  }

  protected onNameChange(): void {
    if (!this.slugTouched) this.slug = slugify(this.name, 40);
  }

  protected toggleModule(module: StoreModule, checked: boolean): void {
    if (checked) this.selected.add(module);
    else this.selected.delete(module);
  }

  protected openForm(): void {
    this.name = '';
    this.slug = '';
    this.slugTouched = false;
    this.selected = new Set();
    this.colorPrimary.set(DEFAULT_STORE_PRIMARY);
    this.matchAccent();
    this.errors.set({});
    this.creating.set(true);
  }

  protected async create(): Promise<void> {
    const parsed = createStoreSchema.safeParse({
      name: this.name,
      slug: this.slug,
      modules: [...this.selected],
      colorPrimary: this.colorPrimary(),
      colorAccent: this.colorAccent(),
    });
    if (!parsed.success) {
      const fields = parsed.error.flatten().fieldErrors;
      this.errors.set({
        name: fields.name ? 'Escribe el nombre de la tienda.' : undefined,
        slug: fields.slug?.[0],
        colorPrimary: fields.colorPrimary?.[0],
        colorAccent: fields.colorAccent?.[0],
      });
      return;
    }
    this.saving.set(true);
    this.errors.set({});
    try {
      await this.stores.create(parsed.data);
      this.creating.set(false);
    } catch (error) {
      const fields = formErrors(apiFields(error, 1), CREATE_FIELDS);
      this.errors.set(
        Object.keys(fields).length
          ? fields
          : { form: apiMessage(error, 'No se pudo crear la tienda. Inténtalo de nuevo.') },
      );
    } finally {
      this.saving.set(false);
    }
  }

  protected async setEnabled(store: StoreDto, event: MatSlideToggleChange): Promise<void> {
    const enabled = event.checked;
    if (
      !enabled &&
      !(await this.confirm.ask({
        title: `¿Deshabilitar ${store.name}?`,
        message: 'La tienda dejará de verse en todos sus dominios hasta que la habilites otra vez. No se borra nada.',
        confirmLabel: 'Deshabilitar tienda',
        destructive: true,
      }))
    ) {
      event.source.checked = true;
      return;
    }
    this.toggling.set(store.id);
    try {
      await this.stores.setEnabled(store.id, enabled);
    } catch {
      event.source.checked = !enabled;
      alert(`No se pudo cambiar el estado de «${store.name}». Inténtalo de nuevo.`);
    } finally {
      this.toggling.set(null);
    }
  }
}
