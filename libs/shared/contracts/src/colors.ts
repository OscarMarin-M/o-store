/**
 * Colores de tienda: tono parecido para el color secundario y colores reservados.
 *
 * El admin reserva tres colores para componentes concretos. Si el color de una tienda
 * se confunde con uno de ellos, un aviso o un botón importante dejaría de distinguirse:
 *   - ámbar: botón de la acción principal y foco del teclado;
 *   - rojo: errores y acciones de borrar;
 *   - verde: confirmaciones ("guardado").
 */

/** Color principal propuesto al crear una tienda: azul acero, lejos de los reservados. */
export const DEFAULT_STORE_PRIMARY = '#3d7f9e';

export interface Hsl {
  /** 0–360 */
  h: number;
  /** 0–1 */
  s: number;
  /** 0–1 */
  l: number;
}

export function hexToHsl(hex: string): Hsl {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s, l };
}

export function hslToHex({ h, s, l }: Hsl): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return (
    '#' +
    [r, g, b]
      .map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0'))
      .join('')
  );
}

/**
 * Tono parecido para el color secundario: misma familia, algo girado y con otra
 * luminosidad, para que se distingan sin chocar.
 */
export function similarShade(hex: string): string {
  const { h, s, l } = hexToHsl(hex);
  return hslToHex({
    h: (h + 14) % 360,
    s: Math.min(1, s * 0.92),
    l: l > 0.55 ? l - 0.14 : l + 0.12,
  });
}

interface Reserved {
  name: string;
  use: string;
  /** Variantes del tema oscuro y del claro. */
  hex: string[];
}

export const RESERVED_COLORS: Reserved[] = [
  { name: 'ámbar', use: 'el botón principal y el foco del teclado', hex: ['#e9b949', '#8a6510'] },
  { name: 'rojo', use: 'los errores y las acciones de borrar', hex: ['#f08a7e', '#b3261e'] },
  { name: 'verde', use: 'las confirmaciones', hex: ['#7cc6a0', '#2e7d55'] },
];

export interface ColorIssue {
  /** blocked: no se acepta. warning: se acepta, pero se avisa. */
  level: 'blocked' | 'warning';
  message: string;
}

function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/** ¿Se confunde este color con uno reservado? null si no hay problema. */
export function reservedColorIssue(hex: string): ColorIssue | null {
  const c = hexToHsl(hex.toLowerCase());
  // Grises y colores muy apagados, muy oscuros o muy claros no se confunden.
  if (c.s < 0.35 || c.l < 0.2 || c.l > 0.88) return null;
  let warning: ColorIssue | null = null;
  for (const r of RESERVED_COLORS) {
    for (const variant of r.hex) {
      const v = hexToHsl(variant);
      const dh = hueDistance(c.h, v.h);
      if (dh <= 12 && Math.abs(c.l - v.l) <= 0.16) {
        return {
          level: 'blocked',
          message: `Se confunde con el ${r.name} que el admin usa para ${r.use}. Elige otro tono, o uno bastante más oscuro o más claro`,
        };
      }
      if (dh <= 24) {
        warning ??= {
          level: 'warning',
          message: `Se parece al ${r.name} que el admin usa para ${r.use}. Se puede usar, pero comprueba que se distinga`,
        };
      }
    }
  }
  return warning;
}
