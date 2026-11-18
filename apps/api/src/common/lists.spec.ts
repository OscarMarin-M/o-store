import { describe, expect, it } from 'vitest';
import { lastPage, productListQuerySchema } from '@o-stores/contracts';

describe('consulta de listas', () => {
  it('aplica página, tamaño y orden por defecto', () => {
    expect(productListQuerySchema.parse({})).toEqual({
      page: 1,
      pageSize: 50,
      sort: 'updatedAt',
      dir: 'desc',
    });
  });

  it('convierte los números que llegan como texto en la URL', () => {
    const q = productListQuerySchema.parse({ page: '3', pageSize: '100', sort: 'name', dir: 'asc' });
    expect(q).toMatchObject({ page: 3, pageSize: 100, sort: 'name', dir: 'asc' });
  });

  it('rechaza tamaños de página no permitidos', () => {
    expect(productListQuerySchema.safeParse({ pageSize: '5000' }).success).toBe(false);
  });

  it('rechaza ordenar por un campo no declarado', () => {
    expect(productListQuerySchema.safeParse({ sort: 'price' }).success).toBe(false);
  });

  it('calcula la última página', () => {
    expect(lastPage(0, 50)).toBe(1);
    expect(lastPage(50, 50)).toBe(1);
    expect(lastPage(51, 50)).toBe(2);
  });
});
