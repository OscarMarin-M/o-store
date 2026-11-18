import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { CategoryDto, CategoryInput } from '@o-stores/contracts';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class CategoriesApi {
  private readonly http = inject(HttpClient);

  list(storeId: string): Promise<CategoryDto[]> {
    return firstValueFrom(this.http.get<CategoryDto[]>(this.base(storeId)));
  }

  create(storeId: string, input: CategoryInput): Promise<CategoryDto> {
    return firstValueFrom(this.http.post<CategoryDto>(this.base(storeId), input));
  }

  update(storeId: string, id: string, input: CategoryInput): Promise<CategoryDto> {
    return firstValueFrom(this.http.put<CategoryDto>(`${this.base(storeId)}/${id}`, input));
  }

  remove(storeId: string, id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.base(storeId)}/${id}`));
  }

  /** `ids`: todas las hermanas de un mismo nivel, en el orden nuevo. */
  reorder(storeId: string, ids: string[]): Promise<CategoryDto[]> {
    return firstValueFrom(this.http.put<CategoryDto[]>(`${this.base(storeId)}/order`, { ids }));
  }

  private base(storeId: string): string {
    return `/api/stores/${storeId}/categories`;
  }
}

export interface CategoryNode extends CategoryDto {
  children: CategoryDto[];
}

/** Árbol de dos niveles, cada nivel ordenado por posición. */
export function categoryTree(list: CategoryDto[]): CategoryNode[] {
  const byPosition = (a: CategoryDto, b: CategoryDto) =>
    a.position - b.position || a.name.localeCompare(b.name, 'es');
  return list
    .filter((c) => !c.parentId)
    .sort(byPosition)
    .map((c) => ({
      ...c,
      children: list.filter((x) => x.parentId === c.id).sort(byPosition),
    }));
}

/** Nombre completo para mostrar: "Yu-Gi-Oh › Sobres". */
export function categoryPath(list: CategoryDto[], id: string | null): string | null {
  const c = id ? list.find((x) => x.id === id) : undefined;
  if (!c) return null;
  const parent = c.parentId ? list.find((x) => x.id === c.parentId) : undefined;
  return parent ? `${parent.name} › ${c.name}` : c.name;
}
