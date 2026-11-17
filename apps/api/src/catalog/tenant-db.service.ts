import { Injectable, NotFoundException } from '@nestjs/common';
import type { Kysely, QueryCreator } from 'kysely';
import { DatabaseService } from '../database/database.service';
import type { TenantDB } from '../database/types';

export interface Tenant {
  storeId: string;
  /** Nombre del esquema, p. ej. tenant_tcg. */
  schema: string;
  /** Consultas ya dirigidas al esquema de la tienda. */
  db: QueryCreator<TenantDB>;
  /** Conexión, para abrir transacciones (dentro, usar trx.withSchema(schema)). */
  conn: Kysely<TenantDB>;
}

/**
 * Da acceso a las tablas de una tienda. Cada consulta va con withSchema, así una
 * petición nunca lee el esquema de otra tienda.
 */
@Injectable()
export class TenantDbService {
  constructor(private readonly database: DatabaseService) {}

  async forStore(storeId: string): Promise<Tenant> {
    const store = await this.database.db
      .selectFrom('platform.stores')
      .select(['id', 'schemaName', 'dbUrl'])
      .where('id', '=', storeId)
      .executeTakeFirst();
    if (!store) throw new NotFoundException('Tienda no encontrada');
    const conn = this.database.forStore(store) as Kysely<TenantDB>;
    return {
      storeId: store.id,
      schema: store.schemaName,
      db: conn.withSchema(store.schemaName),
      conn,
    };
  }
}
