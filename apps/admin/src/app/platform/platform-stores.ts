import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import {
  MatSlideToggleModule,
  type MatSlideToggleChange,
} from '@angular/material/slide-toggle';
import { RouterLink } from '@angular/router';
import {
  STORE_MODULES,
  createStoreSchema,
  type StoreDto,
  type StoreModule,
} from '@o-stores/contracts';
import { StoresService } from '../core/stores.service';

const MODULE_LABELS: Record<StoreModule, string> = {
  tcg: 'Cartas TCG',
  apparel: 'Poleras personalizadas',
};

/** Convierte un nombre en una dirección válida: "Cartas Ñuñoa" → "cartas-nunoa". */
function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

@Component({
  selector: 'os-platform-stores',
  imports: [
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatSlideToggleModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './platform-stores.html',
  styleUrl: './platform-stores.scss',
})
export class PlatformStores {
  protected readonly stores = inject(StoresService);
  protected readonly modules = STORE_MODULES;
  protected readonly moduleLabels = MODULE_LABELS;

  protected readonly creating = signal(false);
  protected readonly saving = signal(false);
  protected readonly errors = signal<Partial<Record<'name' | 'slug' | 'form', string>>>({});
  protected readonly toggling = signal<string | null>(null);

  protected name = '';
  protected slug = '';
  protected slugTouched = false;
  protected selected = new Set<StoreModule>();

  protected moduleLabel(module: string): string {
    return MODULE_LABELS[module as StoreModule] ?? module;
  }

  protected onNameChange(): void {
    if (!this.slugTouched) this.slug = slugify(this.name);
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
    this.errors.set({});
    this.creating.set(true);
  }

  protected async create(): Promise<void> {
    const parsed = createStoreSchema.safeParse({
      name: this.name,
      slug: this.slug,
      modules: [...this.selected],
    });
    if (!parsed.success) {
      const fields = parsed.error.flatten().fieldErrors;
      this.errors.set({
        name: fields.name ? 'Escribe el nombre de la tienda.' : undefined,
        slug: fields.slug?.[0],
      });
      return;
    }
    this.saving.set(true);
    this.errors.set({});
    try {
      await this.stores.create(parsed.data);
      this.creating.set(false);
    } catch (error) {
      this.errors.set(
        error instanceof HttpErrorResponse && error.status === 409
          ? { slug: 'Ya existe una tienda con esta dirección. Elige otra.' }
          : { form: 'No se pudo crear la tienda. Inténtalo de nuevo.' },
      );
    } finally {
      this.saving.set(false);
    }
  }

  protected async setEnabled(store: StoreDto, event: MatSlideToggleChange): Promise<void> {
    const enabled = event.checked;
    if (
      !enabled &&
      !confirm(`¿Deshabilitar «${store.name}»? La tienda dejará de verse en sus dominios hasta que la habilites otra vez.`)
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
