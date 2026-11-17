import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { CamelCasePlugin, Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import { AppConfig } from '../config/app-config';
import type { DB } from './types';

function createPool(connectionString: string): Pool {
  const host = new URL(connectionString).hostname;
  const local = host === 'localhost' || host === '127.0.0.1';
  return new Pool({
    connectionString,
    max: 5,
    // El pooler de Supabase usa un certificado de su propia CA: se cifra la
    // conexión sin validar la cadena. Pendiente: cargar su CA para validarla.
    ssl: local ? undefined : { rejectUnauthorized: false },
  });
}

function createKysely<T>(connectionString: string): Kysely<T> {
  return new Kysely<T>({
    dialect: new PostgresDialect({ pool: createPool(connectionString) }),
    // maintainNestedObjectKeys: no tocar las claves de los JSONB (theme, attributes).
    plugins: [new CamelCasePlugin({ maintainNestedObjectKeys: true })],
  });
}

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  /** Base de datos principal: esquema platform y las tiendas sin db_url. */
  readonly db: Kysely<DB>;
  private readonly external = new Map<string, Kysely<unknown>>();

  constructor(config: AppConfig) {
    this.db = createKysely<DB>(config.databaseUrl);
  }

  /**
   * Conexión donde vive el esquema de una tienda: la principal, o la de su
   * propio proyecto si tiene db_url. Las externas se reutilizan.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  forStore(store: { dbUrl: string | null }): Kysely<any> {
    if (!store.dbUrl) return this.db;
    let conn = this.external.get(store.dbUrl);
    if (!conn) {
      conn = createKysely<unknown>(store.dbUrl);
      this.external.set(store.dbUrl, conn);
    }
    return conn;
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([
      this.db.destroy(),
      ...[...this.external.values()].map((conn) => conn.destroy()),
    ]);
  }
}
