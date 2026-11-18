import {
  DEFAULT_STORE_PRIMARY,
  createStoreSchema,
  hexToHsl,
  hslToHex,
  reservedColorIssue,
  similarShade,
} from '@o-stores/contracts';
import { describe, expect, it } from 'vitest';

describe('colores de tienda', () => {
  it('convierte hex ↔ HSL sin perder el color', () => {
    for (const hex of ['#3d7f9e', '#e9b949', '#111318', '#ffffff', '#7cc6a0']) {
      expect(hslToHex(hexToHsl(hex))).toBe(hex);
    }
  });

  it('el tono parecido es distinto pero de la misma familia', () => {
    const base = hexToHsl(DEFAULT_STORE_PRIMARY);
    const shade = similarShade(DEFAULT_STORE_PRIMARY);
    const s = hexToHsl(shade);
    expect(shade).not.toBe(DEFAULT_STORE_PRIMARY);
    expect(Math.abs(s.h - base.h)).toBeLessThanOrEqual(20);
    expect(Math.abs(s.l - base.l)).toBeGreaterThan(0.08);
  });

  it('bloquea colores que se confunden con los reservados', () => {
    // El ámbar por defecto de la base y los propios colores reservados.
    for (const hex of ['#f2b84b', '#e9b949', '#f08a7e', '#7cc6a0']) {
      expect(reservedColorIssue(hex)?.level).toBe('blocked');
    }
  });

  it('solo avisa si el tono se parece pero la luminosidad es otra', () => {
    // Granate de marca: misma familia que el rojo de error, pero mucho más oscuro.
    expect(reservedColorIssue('#6a140e')?.level).toBe('warning');
    // Un rojo oscuro como #8b1a12 sí se bloquea: es casi el rojo de error del tema claro.
    expect(reservedColorIssue('#8b1a12')?.level).toBe('blocked');
  });

  it('acepta el color por defecto, grises y tonos lejanos', () => {
    for (const hex of [DEFAULT_STORE_PRIMARY, '#5b4bd6', '#777777', '#111318']) {
      expect(reservedColorIssue(hex)).toBeNull();
    }
  });

  it('la API rechaza crear una tienda con un color reservado', () => {
    const result = createStoreSchema.safeParse({ name: 'Cartas', slug: 'cartas', colorPrimary: '#e9b949' });
    expect(result.success).toBe(false);
  });
});
