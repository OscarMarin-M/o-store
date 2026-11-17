import { describe, expect, it } from 'vitest';
import { codePart, productCode, productSlug, variantCode } from '@o-stores/contracts';

describe('códigos de catálogo', () => {
  it('rellena el número del producto con ceros', () => {
    expect(productCode('TCG', 12)).toBe('TCG-0012');
    expect(productCode('P', '12345')).toBe('P-12345');
  });

  it('convierte valores de opciones en partes de código', () => {
    expect(codePart('Negro Mate')).toBe('NEGROMATE');
    expect(codePart('Añil')).toBe('ANIL');
    expect(codePart('2XL')).toBe('2XL');
  });

  it('arma el código de la variante con el del producto', () => {
    expect(variantCode('POL-0003', ['M', 'Negro'])).toBe('POL-0003-M-NEGRO');
    expect(variantCode('TCG-0012', ['Casi nueva', 'Español'])).toBe('TCG-0012-CASINUEVA-ESPANOL');
  });

  it('la dirección del producto incluye el código', () => {
    expect(productSlug('Dragón Blanco de Ojos Azules', 'TCG-0012')).toBe(
      'dragon-blanco-de-ojos-azules-tcg-0012',
    );
  });
});
