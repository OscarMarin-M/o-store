import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { OS_UI } from '../../ui/ui';
import type { LogoUploadInput } from '@o-stores/contracts';
import { StoresService } from '../../core/stores.service';
import { reservedColorIssue } from '@o-stores/contracts';
import { readableTextOn, themeWarnings, type ThemeColors } from './contrast';
import { uploadWithProgress, type UploadHandle } from '../../core/upload';

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const LOGO_TYPES: Record<string, LogoUploadInput['extension']> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

type ColorKey = keyof ThemeColors;

interface LogoUpload {
  file: File;
  previewUrl: string;
  state: 'uploading' | 'done' | 'error';
  progress: number;
  path: string | null;
}

@Component({
  selector: 'os-appearance-page',
  imports: [MatButtonModule, OS_UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './appearance-page.html',
  styleUrl: './appearance-page.scss',
  host: { '(window:paste)': 'onPaste($event)' },
})
export class AppearancePage implements OnDestroy {
  protected readonly stores = inject(StoresService);
  protected readonly store = computed(() => this.stores.active());

  protected readonly colorFields: { key: ColorKey; label: string; hint: string }[] = [
    { key: 'colorPrimary', label: 'Color principal', hint: 'Botones, enlaces y la franja del panel' },
    { key: 'colorAccent', label: 'Color secundario', hint: 'Un tono parecido: etiquetas y detalles' },
    { key: 'colorBackground', label: 'Fondo', hint: 'Fondo de las páginas' },
  ];

  protected readonly colors = signal<ThemeColors>({
    colorPrimary: '#000000',
    colorAccent: '#000000',
    colorBackground: '#000000',
  });
  protected readonly hexErrors = signal<Partial<Record<ColorKey, string>>>({});
  protected readonly logo = signal<LogoUpload | null>(null);
  protected readonly logoError = signal<string | null>(null);
  protected readonly dragging = signal(false);
  protected readonly saving = signal(false);
  protected readonly message = signal<{ kind: 'ok' | 'error'; text: string } | null>(null);

  private upload: UploadHandle | null = null;

  protected readonly warnings = computed(() => {
    const c = this.colors();
    const reserved = (['colorPrimary', 'colorAccent'] as const)
      .map((key) => reservedColorIssue(c[key]))
      .filter((issue) => issue?.level === 'warning')
      .map((issue) => `${issue?.message}.`);
    return [...themeWarnings(c), ...reserved];
  });
  /** Hay un color que no se puede guardar (hex mal escrito o color reservado). */
  protected readonly hasColorErrors = computed(() =>
    Object.values(this.hexErrors()).some(Boolean),
  );
  protected readonly textOnPrimary = computed(() => readableTextOn(this.colors().colorPrimary));
  protected readonly textOnBackground = computed(() =>
    readableTextOn(this.colors().colorBackground),
  );
  protected readonly logoPreview = computed(
    () => this.logo()?.previewUrl ?? this.store()?.logoUrl ?? null,
  );

  protected readonly dirty = computed(() => {
    const store = this.store();
    if (!store) return false;
    const c = this.colors();
    return (
      this.logo()?.state === 'done' ||
      c.colorPrimary !== store.colorPrimary ||
      c.colorAccent !== store.colorAccent ||
      c.colorBackground !== store.colorBackground
    );
  });

  constructor() {
    // Al cambiar de tienda, cargar sus colores y olvidar lo no guardado.
    effect(() => {
      const store = this.store();
      if (!store) return;
      untracked(() => this.reset());
    });
  }

  ngOnDestroy(): void {
    this.upload?.abort();
    this.revokePreview();
  }

  protected reset(): void {
    const store = this.store();
    if (!store) return;
    this.upload?.abort();
    this.revokePreview();
    this.logo.set(null);
    this.logoError.set(null);
    this.colors.set({
      colorPrimary: store.colorPrimary,
      colorAccent: store.colorAccent,
      colorBackground: store.colorBackground,
    });
    // Una tienda creada antes de la regla puede tener un color reservado: se avisa al abrir.
    const blocked = (key: 'colorPrimary' | 'colorAccent') => {
      const issue = reservedColorIssue(store[key]);
      return issue?.level === 'blocked' ? `${issue.message}.` : undefined;
    };
    this.hexErrors.set({ colorPrimary: blocked('colorPrimary'), colorAccent: blocked('colorAccent') });
  }

  protected setColor(key: ColorKey, raw: string): void {
    const value = raw.trim().toLowerCase();
    const hex = value.startsWith('#') ? value : `#${value}`;
    if (!/^#[0-9a-f]{6}$/.test(hex)) {
      this.hexErrors.update((e) => ({ ...e, [key]: 'Usa 6 dígitos hexadecimales, por ejemplo #1a2b3c.' }));
      return;
    }
    // El fondo no tiene restricción; los colores de marca no pueden imitar a los reservados.
    const issue = key === 'colorBackground' ? null : reservedColorIssue(hex);
    this.hexErrors.update((e) => ({
      ...e,
      [key]: issue?.level === 'blocked' ? `${issue.message}.` : undefined,
    }));
    this.colors.update((c) => ({ ...c, [key]: hex }));
    this.message.set(null);
  }

  protected onPick(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) void this.startUpload(file);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    const file = event.dataTransfer?.files[0];
    if (file) void this.startUpload(file);
  }

  protected onPaste(event: ClipboardEvent): void {
    const target = event.target as HTMLElement | null;
    if (target?.closest('input, textarea')) return;
    const file = Array.from(event.clipboardData?.files ?? []).find((f) => f.type.startsWith('image/'));
    if (file) void this.startUpload(file);
  }

  protected cancelUpload(): void {
    this.upload?.abort();
  }

  protected retryUpload(): void {
    const file = this.logo()?.file;
    if (file) void this.startUpload(file);
  }

  protected discardLogo(): void {
    this.upload?.abort();
    this.revokePreview();
    this.logo.set(null);
  }

  protected async save(): Promise<void> {
    const store = this.store();
    if (!store || this.saving()) return;
    this.saving.set(true);
    this.message.set(null);
    const logo = this.logo();
    try {
      await this.stores.update(store.id, {
        ...this.colors(),
        ...(logo?.state === 'done' ? { logoPath: logo.path } : {}),
      });
      this.discardLogo();
      this.message.set({ kind: 'ok', text: 'Cambios guardados. La tienda ya los muestra.' });
    } catch {
      this.message.set({ kind: 'error', text: 'No se pudieron guardar los cambios. Inténtalo de nuevo.' });
    } finally {
      this.saving.set(false);
    }
  }

  private async startUpload(file: File): Promise<void> {
    const store = this.store();
    if (!store) return;
    const extension = LOGO_TYPES[file.type];
    if (!extension) {
      this.logoError.set('El logo debe ser PNG, JPG o WebP. Si es SVG, expórtalo como PNG.');
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      const mb = (file.size / 1024 / 1024).toFixed(1);
      this.logoError.set(`El archivo pesa ${mb} MB y el límite es 2 MB. Redúcelo o expórtalo con menos resolución.`);
      return;
    }
    this.logoError.set(null);
    this.message.set(null);
    this.upload?.abort();
    this.revokePreview();
    this.logo.set({
      file,
      previewUrl: URL.createObjectURL(file),
      state: 'uploading',
      progress: 0,
      path: null,
    });

    try {
      const target = await this.stores.requestLogoUpload(store.id, extension);
      this.upload = uploadWithProgress(target.signedUrl, file, (progress) =>
        this.patchLogo({ progress }),
      );
      await this.upload.done;
      this.patchLogo({ state: 'done', progress: 1, path: target.path });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        this.discardLogo();
      } else {
        this.patchLogo({ state: 'error' });
      }
    } finally {
      this.upload = null;
    }
  }

  private patchLogo(patch: Partial<LogoUpload>): void {
    this.logo.update((l) => (l ? { ...l, ...patch } : l));
  }

  private revokePreview(): void {
    const url = this.logo()?.previewUrl;
    if (url) URL.revokeObjectURL(url);
  }
}
