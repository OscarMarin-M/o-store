import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { ApiError, ApiErrorCode } from '@o-stores/contracts';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { isForeignKeyViolation, isUniqueViolation } from './pg-errors';

const CODES: Record<number, ApiErrorCode> = {
  400: 'bad_request',
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not_found',
  409: 'conflict',
  413: 'payload_too_large',
  422: 'validation',
  429: 'rate_limited',
  502: 'bad_gateway',
  503: 'unavailable',
};

/** Mensajes por defecto cuando la excepción no trae uno propio en español. */
const DEFAULT_MESSAGES: Record<number, string> = {
  400: 'La petición no es válida',
  401: 'Tu sesión no es válida o venció; vuelve a iniciar sesión',
  403: 'No tienes permiso para hacer esto',
  404: 'No se encontró lo que buscas',
  409: 'Choca con datos que ya existen',
  413: 'El contenido enviado es demasiado grande',
  429: 'Demasiadas peticiones; espera un momento',
  500: 'Algo falló en el servidor; inténtalo de nuevo',
  502: 'Un servicio externo no respondió bien; inténtalo de nuevo',
  503: 'El servicio no está disponible ahora; inténtalo en un momento',
};

/** Textos en inglés que Nest y Express ponen cuando la excepción no trae mensaje. */
const NEST_DEFAULTS = new Set([
  'Forbidden resource',
  'Internal Server Error',
  'Http Exception',
  'request entity too large',
  'ThrottlerException: Too Many Requests',
]);

/**
 * Convierte cualquier excepción en un ApiError. Las HttpException conservan su
 * mensaje (los nuestros ya están en español) y sus `fields`; los mensajes genéricos
 * de Nest en inglés ("Not Found", "Cannot GET /x") se sustituyen por los de arriba.
 * Lo inesperado se registra con su traza y responde 500 sin detalles internos.
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('API');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const body = this.toApiError(exception, req);
    if (!res.headersSent) res.status(body.statusCode).json(body);
  }

  toApiError(exception: unknown, req?: Pick<Request, 'method' | 'originalUrl'>): ApiError {
    if (exception instanceof HttpException) {
      return this.fromHttpException(exception);
    }
    // Restricciones de Postgres que un servicio no tradujo: mejor 409/400 que un 500.
    if (isUniqueViolation(exception)) {
      return { statusCode: 409, code: 'conflict', message: DEFAULT_MESSAGES[409] };
    }
    if (isForeignKeyViolation(exception)) {
      return { statusCode: 400, code: 'bad_request', message: 'Alguno de los datos relacionados ya no existe' };
    }
    const requestId = randomUUID().slice(0, 8);
    const where = req ? `${req.method} ${req.originalUrl}` : '';
    this.logger.error(
      `[${requestId}] ${where} ${exception instanceof Error ? exception.message : String(exception)}`,
      exception instanceof Error ? exception.stack : undefined,
    );
    return { statusCode: 500, code: 'internal', message: DEFAULT_MESSAGES[500], requestId };
  }

  private fromHttpException(exception: HttpException): ApiError {
    const statusCode = exception.getStatus();
    const response = exception.getResponse();
    const raw = typeof response === 'string' ? { message: response } : (response as Record<string, unknown>);

    let fields: Record<string, string> | undefined;
    if (raw['fields'] && typeof raw['fields'] === 'object') {
      fields = raw['fields'] as Record<string, string>;
    }
    const message = this.ownMessage(raw['message'], statusCode) ?? DEFAULT_MESSAGES[statusCode] ?? DEFAULT_MESSAGES[500];
    const code: ApiErrorCode = fields && statusCode === 400 ? 'validation' : (CODES[statusCode] ?? (statusCode >= 500 ? 'internal' : 'bad_request'));

    if (statusCode >= 500) {
      this.logger.error(`${statusCode} ${message}`, exception.stack);
    }
    return fields ? { statusCode, code, message, fields } : { statusCode, code, message };
  }

  /** El mensaje propio de la excepción, o undefined si es uno genérico de Nest/Express. */
  private ownMessage(message: unknown, statusCode: number): string | undefined {
    if (typeof message !== 'string' || !message) return undefined;
    const statusName = HttpStatus[statusCode]?.toLowerCase().replace(/_/g, ' '); // NOT_FOUND → "not found"
    const generic =
      message.toLowerCase() === statusName ||
      NEST_DEFAULTS.has(message) ||
      /^Cannot (GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) /.test(message) || // ruta inexistente
      /JSON|Unexpected token|Unexpected end/.test(message); // cuerpo JSON mal formado
    return generic ? undefined : message;
  }
}
