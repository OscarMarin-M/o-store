import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { fieldError, productInputSchema } from '@o-stores/contracts';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ApiExceptionFilter } from './api-exception.filter';
import { ZodBody } from './zod-body.pipe';

describe('ApiExceptionFilter', () => {
  const filter = new ApiExceptionFilter();
  const req = { method: 'GET', originalUrl: '/api/x' };
  beforeAll(() => vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined));
  afterAll(() => vi.restoreAllMocks());

  it('conserva los mensajes propios en español', () => {
    expect(filter.toApiError(new NotFoundException('Tienda no encontrada'), req)).toEqual({
      statusCode: 404,
      code: 'not_found',
      message: 'Tienda no encontrada',
    });
  });

  it('traduce los mensajes genéricos de Nest', () => {
    expect(filter.toApiError(new ForbiddenException(), req).message).toBe('No tienes permiso para hacer esto');
    expect(filter.toApiError(new NotFoundException('Cannot GET /api/nada'), req).message).toBe(
      'No se encontró lo que buscas',
    );
    expect(filter.toApiError(new BadRequestException('Unexpected token } in JSON at position 3'), req).message).toBe(
      'La petición no es válida',
    );
  });

  it('pasa los errores por campo de las reglas de negocio', () => {
    expect(filter.toApiError(new ConflictException(fieldError('slug', 'Ya existe')), req)).toEqual({
      statusCode: 409,
      code: 'conflict',
      message: 'Ya existe',
      fields: { slug: 'Ya existe' },
    });
  });

  it('marca como validation los errores de zod, con la ruta completa', () => {
    let thrown: unknown;
    try {
      new ZodBody(productInputSchema).transform({ name: '', price: 1, variants: [{ optionValues: ['M'], price: -1 }] });
    } catch (error) {
      thrown = error;
    }
    const body = filter.toApiError(thrown, req);
    expect(body.code).toBe('validation');
    expect(body.fields).toMatchObject({ name: 'Escribe el nombre', 'variants.0.price': 'No puede ser negativo' });
  });

  it('traduce restricciones de Postgres que se escaparon', () => {
    expect(filter.toApiError({ code: '23505' }, req).statusCode).toBe(409);
    expect(filter.toApiError({ code: '23503' }, req).statusCode).toBe(400);
  });

  it('oculta los detalles de lo inesperado y da un id para el registro', () => {
    const body = filter.toApiError(new Error('connection refused at 10.0.0.1'), req);
    expect(body).toMatchObject({ statusCode: 500, code: 'internal' });
    expect(body.message).not.toContain('10.0.0.1');
    expect(body.requestId).toMatch(/^[0-9a-f]{8}$/);
  });

  it('mantiene el código de los errores de servicios externos', () => {
    expect(filter.toApiError(new BadGatewayException('Supabase no respondió'), req)).toMatchObject({
      statusCode: 502,
      code: 'bad_gateway',
      message: 'Supabase no respondió',
    });
  });
});
