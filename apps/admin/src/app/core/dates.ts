/**
 * Fechas del admin, siempre en hora de Bolivia (America/La_Paz), aunque el
 * navegador esté en otra zona: un pedido de las 23:30 en La Paz es de ese día.
 */
export const TIME_ZONE = 'America/La_Paz';

const day = new Intl.DateTimeFormat('es-BO', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: TIME_ZONE,
});

/** "2026-11-17T22:10:00Z" -> "17 nov 2026" */
export function formatDay(iso: string): string {
  return day.format(new Date(iso));
}
