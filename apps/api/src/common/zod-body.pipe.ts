import { BadRequestException, PipeTransform } from '@nestjs/common';
import { type ApiErrorBody, issuesToFields } from '@o-stores/contracts';
import type { ZodType } from 'zod';

/** Valida el cuerpo (o la consulta) con un esquema de @o-stores/contracts. */
export class ZodBody<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value ?? {});
    if (!result.success) {
      const body: ApiErrorBody = {
        message: 'Revisa los datos marcados',
        fields: issuesToFields(result.error.issues),
      };
      throw new BadRequestException(body);
    }
    return result.data;
  }
}
