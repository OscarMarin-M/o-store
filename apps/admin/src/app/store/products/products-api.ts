import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type {
  ExchangeRateDto,
  ProductDto,
  ProductImageUploadDto,
  ProductInput,
  ProductListDto,
  ProductListQuery,
  ProductStatus,
  StoreSettingsDto,
  UpdateStoreSettingsInput,
} from '@o-stores/contracts';
import { firstValueFrom } from 'rxjs';

/** Productos, ajustes de tienda y tipo de cambio. */
@Injectable({ providedIn: 'root' })
export class ProductsApi {
  private readonly http = inject(HttpClient);

  list(storeId: string, query: Partial<ProductListQuery>): Promise<ProductListDto> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') params = params.set(key, String(value));
    }
    return firstValueFrom(this.http.get<ProductListDto>(this.base(storeId), { params }));
  }

  get(storeId: string, id: string): Promise<ProductDto> {
    return firstValueFrom(this.http.get<ProductDto>(`${this.base(storeId)}/${id}`));
  }

  create(storeId: string, input: ProductInput): Promise<ProductDto> {
    return firstValueFrom(this.http.post<ProductDto>(this.base(storeId), input));
  }

  update(storeId: string, id: string, input: ProductInput): Promise<ProductDto> {
    return firstValueFrom(this.http.put<ProductDto>(`${this.base(storeId)}/${id}`, input));
  }

  setStatus(storeId: string, id: string, status: ProductStatus): Promise<ProductDto> {
    return firstValueFrom(
      this.http.put<ProductDto>(`${this.base(storeId)}/${id}/status`, { status }),
    );
  }

  requestImageUpload(storeId: string, extension: string): Promise<ProductImageUploadDto> {
    return firstValueFrom(
      this.http.post<ProductImageUploadDto>(`${this.base(storeId)}/image-upload`, { extension }),
    );
  }

  settings(storeId: string): Promise<StoreSettingsDto> {
    return firstValueFrom(this.http.get<StoreSettingsDto>(`/api/stores/${storeId}/settings`));
  }

  updateSettings(storeId: string, input: UpdateStoreSettingsInput): Promise<StoreSettingsDto> {
    return firstValueFrom(
      this.http.patch<StoreSettingsDto>(`/api/stores/${storeId}/settings`, input),
    );
  }

  exchangeRate(): Promise<ExchangeRateDto> {
    return firstValueFrom(this.http.get<ExchangeRateDto>('/api/public/exchange-rate'));
  }

  private base(storeId: string): string {
    return `/api/stores/${storeId}/products`;
  }
}

export const STATUS_LABELS: Record<ProductStatus, string> = {
  draft: 'Borrador',
  active: 'Publicado',
  archived: 'Archivado',
};
