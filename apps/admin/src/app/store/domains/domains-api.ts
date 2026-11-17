import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { StoreDomainDto } from '@o-stores/contracts';
import { firstValueFrom } from 'rxjs';

/** Llamadas a /api/stores/:storeId/domains. */
@Injectable({ providedIn: 'root' })
export class DomainsApi {
  private readonly http = inject(HttpClient);

  list(storeId: string): Promise<StoreDomainDto[]> {
    return firstValueFrom(this.http.get<StoreDomainDto[]>(this.base(storeId)));
  }

  add(storeId: string, domain: string): Promise<StoreDomainDto> {
    return firstValueFrom(
      this.http.post<StoreDomainDto>(this.base(storeId), { domain, isPrimary: false }),
    );
  }

  check(storeId: string, id: string): Promise<StoreDomainDto> {
    return firstValueFrom(
      this.http.post<StoreDomainDto>(`${this.base(storeId)}/${id}/check`, {}),
    );
  }

  update(
    storeId: string,
    id: string,
    changes: { isPrimary?: true; verified?: boolean },
  ): Promise<StoreDomainDto> {
    return firstValueFrom(
      this.http.patch<StoreDomainDto>(`${this.base(storeId)}/${id}`, changes),
    );
  }

  remove(storeId: string, id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.base(storeId)}/${id}`));
  }

  private base(storeId: string): string {
    return `/api/stores/${storeId}/domains`;
  }
}
