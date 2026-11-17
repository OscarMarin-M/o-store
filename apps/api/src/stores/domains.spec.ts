import { describe, expect, it } from 'vitest';
import {
  isPlatformDomain,
  normalizeHost,
  platformSlugFromHost,
  txtRecordsContain,
  verificationToken,
} from './domains';

describe('dominios', () => {
  it('el código de verificación es estable y depende del dominio', () => {
    const a = verificationToken('secreto', 'id-1');
    expect(a).toBe(verificationToken('secreto', 'id-1'));
    expect(a).not.toBe(verificationToken('secreto', 'id-2'));
    expect(a).toMatch(/^ostores-verify=[0-9a-f]{32}$/);
  });

  it('normaliza el host', () => {
    expect(normalizeHost(' Tienda.CL:443 ')).toBe('tienda.cl');
    expect(normalizeHost('tienda.cl.')).toBe('tienda.cl');
  });

  it('reconoce los dominios de la plataforma', () => {
    expect(isPlatformDomain('ostores.cl', 'ostores.cl')).toBe(true);
    expect(isPlatformDomain('tcg.ostores.cl', 'ostores.cl')).toBe(true);
    expect(isPlatformDomain('miostores.cl', 'ostores.cl')).toBe(false);
  });

  it('saca el slug de un subdominio de la plataforma', () => {
    expect(platformSlugFromHost('tcg.localhost', 'localhost')).toBe('tcg');
    expect(platformSlugFromHost('a.b.localhost', 'localhost')).toBeNull();
    expect(platformSlugFromHost('localhost', 'localhost')).toBeNull();
    expect(platformSlugFromHost('tcg.otro.cl', 'localhost')).toBeNull();
  });

  it('une los trozos del TXT antes de comparar', () => {
    expect(txtRecordsContain([['ostores-verify=', 'abc']], 'ostores-verify=abc')).toBe(true);
    expect(txtRecordsContain([['otra-cosa']], 'ostores-verify=abc')).toBe(false);
  });
});
