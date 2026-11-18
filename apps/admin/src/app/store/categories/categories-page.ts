import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { categoryInputSchema, slugify, type CategoryDto } from '@o-stores/contracts';
import { apiMessage } from '../../core/api-error';
import { ConfirmService } from '../../core/confirm.service';
import { StoresService } from '../../core/stores.service';
import { OS_UI } from '../../ui/ui';
import { CategoriesApi, categoryTree, type CategoryNode } from './categories-api';

interface Draft {
  /** null = categoría nueva. */
  id: string | null;
  name: string;
  slug: string;
  parentId: string | null;
  /** Si la categoría tiene subcategorías no puede pasar a ser subcategoría. */
  hasChildren: boolean;
}

@Component({
  selector: 'os-categories-page',
  imports: [FormsModule, MatButtonModule, NgTemplateOutlet, RouterLink, OS_UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './categories-page.html',
  styleUrl: './categories-page.scss',
})
export class CategoriesPage {
  private readonly api = inject(CategoriesApi);
  private readonly stores = inject(StoresService);
  private readonly confirm = inject(ConfirmService);
  private readonly nameInput = viewChild<ElementRef<HTMLInputElement>>('nameInput');

  protected readonly store = computed(() => this.stores.active());
  protected readonly categories = signal<CategoryDto[]>([]);
  protected readonly tree = computed(() => categoryTree(this.categories()));
  protected readonly status = signal<'loading' | 'ready' | 'error'>('loading');

  protected readonly draft = signal<Draft | null>(null);
  /** Errores por campo (name, slug, parentId) o 'form' si no son de uno concreto. */
  protected readonly errors = signal<Record<string, string>>({});
  protected readonly saving = signal(false);
  protected readonly busyId = signal<string | null>(null);
  protected readonly notice = signal<{ kind: 'ok' | 'error'; text: string } | null>(null);

  /** Posibles categorías superiores: las de primer nivel, menos la que se edita. */
  protected readonly parentOptions = computed(() =>
    this.tree().filter((c) => c.id !== this.draft()?.id),
  );
  /** Dirección que se usará si se deja vacía. */
  protected readonly slugPreview = computed(() => slugify(this.draft()?.name ?? '') || 'categoria');

  constructor() {
    const storeId = computed(() => this.store()?.id ?? null);
    effect(() => {
      const id = storeId();
      if (!id) return;
      untracked(() => {
        // Al cambiar de tienda no se arrastra un formulario a medias.
        this.draft.set(null);
        this.notice.set(null);
        void this.load(id);
      });
    });
  }

  protected startCreate(parentId: string | null = null): void {
    this.openDraft({ id: null, name: '', slug: '', parentId, hasChildren: false });
  }

  protected startEdit(c: CategoryDto, hasChildren: boolean): void {
    this.openDraft({ id: c.id, name: c.name, slug: c.slug, parentId: c.parentId, hasChildren });
  }

  protected patchDraft(patch: Partial<Draft>): void {
    this.draft.update((d) => (d ? { ...d, ...patch } : d));
  }

  protected async save(): Promise<void> {
    const storeId = this.store()?.id;
    const d = this.draft();
    if (!storeId || !d) return;
    const parsed = categoryInputSchema.safeParse({
      name: d.name,
      slug: d.slug.trim() || undefined,
      parentId: d.parentId,
    });
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? 'form');
        errors[key] ??= issue.message;
      }
      this.errors.set(errors);
      return;
    }
    this.errors.set({});
    this.saving.set(true);
    try {
      const saved = d.id
        ? await this.api.update(storeId, d.id, parsed.data)
        : await this.api.create(storeId, parsed.data);
      await this.load(storeId, false);
      this.draft.set(null);
      this.notice.set({ kind: 'ok', text: d.id ? `«${saved.name}» guardada.` : `«${saved.name}» creada.` });
    } catch (error) {
      const text = apiMessage(error, 'No se pudo guardar la categoría.');
      // Al guardar, la API solo responde 409 cuando la dirección ya existe.
      const conflict = error instanceof HttpErrorResponse && error.status === 409;
      this.errors.set(conflict ? { slug: text } : { form: text });
    } finally {
      this.saving.set(false);
    }
  }

  /** Cambia una categoría de sitio con su vecina y guarda el orden de ese nivel. */
  protected async move(siblings: CategoryDto[], index: number, delta: -1 | 1): Promise<void> {
    const storeId = this.store()?.id;
    const target = index + delta;
    if (!storeId || target < 0 || target >= siblings.length) return;
    const ids = siblings.map((s) => s.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    // Se ve el cambio al instante; si falla, se vuelve a cargar lo guardado.
    const positions = new Map(ids.map((id, i) => [id, i]));
    this.categories.update((list) =>
      list.map((c) => (positions.has(c.id) ? { ...c, position: positions.get(c.id) ?? c.position } : c)),
    );
    this.busyId.set(siblings[index].id);
    try {
      this.categories.set(await this.api.reorder(storeId, ids));
    } catch (error) {
      this.notice.set({ kind: 'error', text: apiMessage(error, 'No se pudo guardar el orden.') });
      await this.load(storeId, false);
    } finally {
      this.busyId.set(null);
    }
  }

  protected async remove(c: CategoryNode | CategoryDto): Promise<void> {
    const storeId = this.store()?.id;
    if (!storeId) return;
    if ('children' in c && c.children.length) {
      this.notice.set({
        kind: 'error',
        text: `«${c.name}» tiene subcategorías. Muévelas a otra categoría o bórralas antes.`,
      });
      return;
    }
    const ok = await this.confirm.ask({
      title: `Borrar «${c.name}»`,
      message: c.productCount
        ? `Sus ${c.productCount} productos quedarán sin categoría. Los productos no se borran.`
        : 'No tiene productos asignados.',
      confirmLabel: 'Borrar categoría',
      destructive: true,
    });
    if (!ok) return;
    this.busyId.set(c.id);
    try {
      await this.api.remove(storeId, c.id);
      if (this.draft()?.id === c.id) this.draft.set(null);
      await this.load(storeId, false);
      this.notice.set({ kind: 'ok', text: `«${c.name}» borrada.` });
    } catch (error) {
      this.notice.set({ kind: 'error', text: apiMessage(error, 'No se pudo borrar la categoría.') });
    } finally {
      this.busyId.set(null);
    }
  }

  /** Productos de una categoría principal: los suyos más los de sus subcategorías. */
  protected total(c: CategoryNode): number {
    return c.children.reduce((sum, x) => sum + x.productCount, c.productCount);
  }

  protected retry(): void {
    const id = this.store()?.id;
    if (id) void this.load(id);
  }

  private openDraft(draft: Draft): void {
    this.errors.set({});
    this.notice.set(null);
    this.draft.set(draft);
    // El formulario aparece arriba: lleva el foco al nombre para escribir directo.
    setTimeout(() => this.nameInput()?.nativeElement.focus());
  }

  private async load(storeId: string, showLoading = true): Promise<void> {
    if (showLoading) this.status.set('loading');
    try {
      this.categories.set(await this.api.list(storeId));
      this.status.set('ready');
    } catch {
      if (showLoading) this.status.set('error');
    }
  }
}
