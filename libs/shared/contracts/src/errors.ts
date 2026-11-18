/**
 * Formato único de los errores de la API. Toda respuesta 4xx/5xx tiene esta forma,
 * venga de una validación, de una regla de negocio o de un fallo inesperado.
 */
export const API_ERROR_CODES = [
  'bad_request',
  'validation',
  'unauthorized',
  'forbidden',
  'not_found',
  'conflict',
  'payload_too_large',
  'rate_limited',
  'internal',
  'bad_gateway',
  'unavailable',
] as const;
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export interface ApiError {
  statusCode: number;
  code: ApiErrorCode;
  /** Mensaje para mostrar a la persona, en español y sin punto final. */
  message: string;
  /**
   * Errores por campo: clave = ruta del campo con puntos ("slug", "variants.0.price"),
   * valor = el primer mensaje de ese campo.
   */
  fields?: Record<string, string>;
  /** Solo en errores 500: para buscar el detalle en el registro de la API. */
  requestId?: string;
}

/** Lo que se pasa a una excepción de Nest para que el error apunte a un campo. */
export interface ApiErrorBody {
  message: string;
  fields?: Record<string, string>;
}

/** Error de negocio sobre un campo concreto: `throw new ConflictException(fieldError('slug', '...'))`. */
export function fieldError(field: string, message: string): ApiErrorBody {
  return { message, fields: { [field]: message } };
}

/**
 * Convierte los issues de zod en errores por campo. `depth` recorta la ruta
 * (depth 1: "variants.0.price" → "variants") y se queda con el primer mensaje.
 */
export function issuesToFields(
  issues: readonly { path: readonly PropertyKey[]; message: string }[],
  depth = Infinity,
): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.slice(0, depth).map(String).join('.') || 'form';
    fields[key] ??= issue.message;
  }
  return fields;
}

/** Recorta las claves de unos errores por campo a `depth` niveles (el primero gana). */
export function trimFields(fields: Record<string, string>, depth: number): Record<string, string> {
  return issuesToFields(
    Object.entries(fields).map(([key, message]) => ({ path: key.split('.'), message })),
    depth,
  );
}

export function isApiError(value: unknown): value is ApiError {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<ApiError>;
  return typeof v.statusCode === 'number' && typeof v.code === 'string' && typeof v.message === 'string';
}
