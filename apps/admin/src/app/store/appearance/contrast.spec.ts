import { contrastRatio, readableTextOn, themeWarnings } from './contrast';

describe('contraste', () => {
  it('negro sobre blanco da 21', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
  });

  it('el orden de los colores no importa', () => {
    expect(contrastRatio('#e9b949', '#1c2624')).toBeCloseTo(
      contrastRatio('#1c2624', '#e9b949'),
    );
  });

  it('elige texto oscuro sobre amarillo y claro sobre azul oscuro', () => {
    expect(readableTextOn('#e9b949')).toBe('#111111');
    expect(readableTextOn('#1a237e')).toBe('#ffffff');
  });

  it('avisa cuando el acento se confunde con el fondo', () => {
    const warnings = themeWarnings({
      colorPrimary: '#e9b949',
      colorAccent: '#202020',
      colorBackground: '#1c1c1c',
    });
    expect(warnings).toEqual(['El color de acento se confunde con el fondo.']);
  });

  it('no avisa con una combinación legible', () => {
    expect(
      themeWarnings({
        colorPrimary: '#e9b949',
        colorAccent: '#7cc6a0',
        colorBackground: '#1c2624',
      }),
    ).toEqual([]);
  });
});
