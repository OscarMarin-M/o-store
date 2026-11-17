/** Contraste WCAG entre colores hex (#rrggbb). */

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Blanco o casi negro, el que mejor se lea sobre el color dado. */
export function readableTextOn(hex: string): '#ffffff' | '#111111' {
  return contrastRatio(hex, '#ffffff') >= contrastRatio(hex, '#111111')
    ? '#ffffff'
    : '#111111';
}

export interface ThemeColors {
  colorPrimary: string;
  colorAccent: string;
  colorBackground: string;
}

/** Avisos en lenguaje llano para una combinación de colores de tienda. */
export function themeWarnings(c: ThemeColors): string[] {
  const warnings: string[] = [];
  if (contrastRatio(c.colorPrimary, readableTextOn(c.colorPrimary)) < 4.5) {
    warnings.push('El texto de los botones se leerá con dificultad sobre el color principal.');
  }
  if (contrastRatio(c.colorPrimary, c.colorBackground) < 3) {
    warnings.push('El color principal se confunde con el fondo.');
  }
  if (contrastRatio(c.colorAccent, c.colorBackground) < 3) {
    warnings.push('El color de acento se confunde con el fondo.');
  }
  return warnings;
}
