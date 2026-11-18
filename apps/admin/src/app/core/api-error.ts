import { HttpErrorResponse } from '@angular/common/http';
import { type ApiError, isApiError, trimFields } from '@o-stores/contracts';

/** El ApiError que devolvió la API, o null si el fallo no vino de ella (red caída, proxy, etc.). */
export function apiError(error: unknown): ApiError | null {
  return error instanceof HttpErrorResponse && isApiError(error.error) ? error.error : null;
}

/**
 * Mensaje para mostrar a la persona. Usa el de la API (ya en español); en un 500
 * añade el código para encontrar el detalle en el registro; sin conexión lo dice.
 */
export function apiMessage(error: unknown, fallback: string): string {
  const body = apiError(error);
  if (body) {
    return body.requestId ? `${body.message} (código ${body.requestId}).` : `${body.message}.`;
  }
  if (error instanceof HttpErrorResponse && error.status === 0) {
    return 'No hay conexión con el servidor. Revisa tu red e inténtalo de nuevo.';
  }
  return fallback;
}

/**
 * Errores por campo de la API, con las claves recortadas a `depth` niveles para
 * que coincidan con las del formulario ("variants.0.price" → "variants.0" con depth 2).
 */
export function apiFields(error: unknown, depth = Infinity): Record<string, string> {
  const fields = apiError(error)?.fields;
  return fields ? trimFields(fields, depth) : {};
}

/**
 * Reparte errores por campo entre los que el formulario muestra (`shown`) y el resto,
 * que se juntan en `form` para que ningún error quede sin verse.
 */
export function formErrors(fields: Record<string, string>, shown: readonly string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, message] of Object.entries(fields)) {
    if (shown.includes(key)) result[key] ??= message;
    else result['form'] ??= message;
  }
  return result;
}
