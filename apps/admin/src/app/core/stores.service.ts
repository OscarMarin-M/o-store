import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import type {
  CreateStoreInput,
  LogoUploadDto,
  LogoUploadInput,
  StoreDto,
  UpdateStoreInput,
} from '@o-stores/contracts';
import { firstValueFrom } from 'rxjs';

/** Tiendas visibles para el usuario y cuál se está editando. */
@Injectable({ providedIn: 'root' })
export class StoresService {
  private readonly http = inject(HttpClient);

  readonly stores = signal<StoreDto[]>([]);
  readonly status = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');
  readonly activeId = signal<string | null>(null);
  readonly active = computed(
    () => this.stores().find((s) => s.id === this.activeId()) ?? null,
  );

  async load(): Promise<void> {
    this.status.set('loading');
    try {
      const list = await firstValueFrom(this.http.get<StoreDto[]>('/api/stores'));
      this.stores.set(list);
      this.status.set('ready');
    } catch {
      this.status.set('error');
    }
  }

  async create(input: CreateStoreInput): Promise<StoreDto> {
    const store = await firstValueFrom(
      this.http.post<StoreDto>('/api/stores', input),
    );
    this.stores.update((list) => [...list, store]);
    return store;
  }

  async setEnabled(id: string, enabled: boolean): Promise<void> {
    const store = await firstValueFrom(
      this.http.put<StoreDto>(`/api/stores/${id}/enabled`, { enabled }),
    );
    this.replace(store);
  }

  async update(id: string, input: UpdateStoreInput): Promise<StoreDto> {
    const store = await firstValueFrom(
      this.http.patch<StoreDto>(`/api/stores/${id}`, input),
    );
    this.replace(store);
    return store;
  }

  /** Pide a la API una URL firmada para subir el logo directo a Storage. */
  requestLogoUpload(id: string, extension: LogoUploadInput['extension']): Promise<LogoUploadDto> {
    return firstValueFrom(
      this.http.post<LogoUploadDto>(`/api/stores/${id}/logo-upload`, { extension }),
    );
  }

  private replace(store: StoreDto): void {
    this.stores.update((list) => list.map((s) => (s.id === store.id ? store : s)));
  }
}
