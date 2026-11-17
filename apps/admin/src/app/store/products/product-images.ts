import { CdkDrag, CdkDragDrop, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  input,
  model,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { uploadWithProgress, type UploadHandle } from '../../core/upload';

export interface ImageItem {
  key: string;
  /** Ruta en Storage; null mientras no termine de subir. */
  path: string | null;
  url: string;
  state: 'uploading' | 'done' | 'error';
  progress: number;
  file?: File;
}

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_IMAGES = 12;
const TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

/** Pide la URL firmada para subir una foto; lo da el formulario. */
export type RequestUpload = (extension: string) => Promise<{ path: string; signedUrl: string }>;

/**
 * Fotos del producto: arrastrar, pegar o elegir varias; vista previa inmediata,
 * progreso por archivo, cancelar y reintentar; reordenar arrastrando (la primera es la portada).
 */
@Component({
  selector: 'os-product-images',
  imports: [CdkDropList, CdkDrag, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(window:paste)': 'onPaste($event)' },
  template: `
    <label
      class="drop"
      [class.dragging]="dragging()"
      (dragover)="onDragOver($event)"
      (dragleave)="dragging.set(false)"
      (drop)="onDrop($event)"
    >
      <input type="file" multiple accept="image/png,image/jpeg,image/webp" (change)="onPick($event)" />
      <span>Arrastra fotos aquí, pégalas o <u>elige archivos</u></span>
      <span class="os-muted">PNG, JPG o WebP, hasta 5 MB cada una y {{ max }} en total. La primera es la portada.</span>
    </label>

    @if (error(); as e) {
      <p class="os-error" role="alert">{{ e }}</p>
    }

    @if (images().length) {
      <ol class="grid" cdkDropList cdkDropListOrientation="mixed" (cdkDropListDropped)="reorder($event)" aria-label="Fotos, en orden">
        @for (img of images(); track img.key; let first = $first; let i = $index) {
          <li class="item" cdkDrag [cdkDragData]="img" [class.cover]="first">
            <img [src]="img.url" alt="" />
            @if (first) {
              <span class="badge">Portada</span>
            }
            @switch (img.state) {
              @case ('uploading') {
                <progress [value]="img.progress" max="1" aria-label="Subiendo foto"></progress>
              }
              @case ('error') {
                <span class="failed">No se subió</span>
              }
            }
            <div class="item-actions">
              @if (img.state === 'error') {
                <button mat-button type="button" (click)="retry(img)">Reintentar</button>
              }
              @if (!first && img.state === 'done') {
                <button mat-button type="button" (click)="makeCover(i)">Portada</button>
              }
              <button mat-button type="button" (click)="remove(img)">
                {{ img.state === 'uploading' ? 'Cancelar' : 'Quitar' }}
              </button>
            </div>
          </li>
        }
      </ol>
    }
  `,
  styleUrl: './product-images.scss',
})
export class ProductImages implements OnDestroy {
  readonly images = model<ImageItem[]>([]);
  readonly requestUpload = input.required<RequestUpload>();

  protected readonly max = MAX_IMAGES;
  protected readonly dragging = signal(false);
  protected readonly error = signal<string | null>(null);
  private readonly uploads = new Map<string, UploadHandle>();

  ngOnDestroy(): void {
    for (const handle of this.uploads.values()) handle.abort();
    for (const img of this.images()) if (img.file) URL.revokeObjectURL(img.url);
  }

  protected onDragOver(event: DragEvent): void {
    if (!event.dataTransfer?.types.includes('Files')) return;
    event.preventDefault();
    this.dragging.set(true);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    this.add(Array.from(event.dataTransfer?.files ?? []));
  }

  protected onPick(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.add(Array.from(input.files ?? []));
    input.value = '';
  }

  protected onPaste(event: ClipboardEvent): void {
    if ((event.target as HTMLElement | null)?.closest('input, textarea')) return;
    const files = Array.from(event.clipboardData?.files ?? []).filter((f) => f.type.startsWith('image/'));
    if (files.length) this.add(files);
  }

  protected reorder(event: CdkDragDrop<ImageItem[]>): void {
    const list = [...this.images()];
    moveItemInArray(list, event.previousIndex, event.currentIndex);
    this.images.set(list);
  }

  protected makeCover(index: number): void {
    const list = [...this.images()];
    const [img] = list.splice(index, 1);
    this.images.set([img, ...list]);
  }

  protected remove(img: ImageItem): void {
    this.uploads.get(img.key)?.abort();
    this.uploads.delete(img.key);
    if (img.file) URL.revokeObjectURL(img.url);
    this.images.update((list) => list.filter((i) => i.key !== img.key));
  }

  protected retry(img: ImageItem): void {
    if (img.file) void this.upload(img.key, img.file);
  }

  private add(files: File[]): void {
    this.error.set(null);
    const room = MAX_IMAGES - this.images().length;
    const problems: string[] = [];
    const accepted: File[] = [];
    for (const file of files) {
      if (!TYPES[file.type]) problems.push(`${file.name}: solo PNG, JPG o WebP.`);
      else if (file.size > MAX_BYTES) problems.push(`${file.name}: pesa ${(file.size / 1048576).toFixed(1)} MB y el límite es 5 MB.`);
      else accepted.push(file);
    }
    if (accepted.length > room) {
      problems.push(`Caben ${room} fotos más; se añadieron las primeras.`);
      accepted.length = Math.max(0, room);
    }
    if (problems.length) this.error.set(problems.join(' '));

    for (const file of accepted) {
      const key = crypto.randomUUID();
      this.images.update((list) => [
        ...list,
        { key, path: null, url: URL.createObjectURL(file), state: 'uploading', progress: 0, file },
      ]);
      void this.upload(key, file);
    }
  }

  private async upload(key: string, file: File): Promise<void> {
    this.patch(key, { state: 'uploading', progress: 0 });
    try {
      const target = await this.requestUpload()(TYPES[file.type]);
      const handle = uploadWithProgress(target.signedUrl, file, (progress) => this.patch(key, { progress }));
      this.uploads.set(key, handle);
      await handle.done;
      this.patch(key, { state: 'done', progress: 1, path: target.path });
    } catch (error) {
      // Cancelada: la foto ya se quitó de la lista.
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        this.patch(key, { state: 'error' });
      }
    } finally {
      this.uploads.delete(key);
    }
  }

  private patch(key: string, changes: Partial<ImageItem>): void {
    this.images.update((list) => list.map((i) => (i.key === key ? { ...i, ...changes } : i)));
  }
}
