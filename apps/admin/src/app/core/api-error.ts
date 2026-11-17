import { HttpErrorResponse } from '@angular/common/http';

/** Mensaje de la API para mostrar al usuario, o el texto de respaldo. */
export function apiMessage(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse && error.status >= 400 && error.status < 500) {
    const message = (error.error as { message?: unknown } | null)?.message;
    if (typeof message === 'string' && message) return `${message}.`;
  }
  return fallback;
}
