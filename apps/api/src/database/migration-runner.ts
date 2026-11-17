import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { sql, type Transaction } from 'kysely';

const IDENTIFIER = /^[a-z_][a-z0-9_]{0,62}$/;
const TENANT_SCHEMA = /^tenant_[a-z0-9_]+$/;
const MODULE_NAME = /^[a-z][a-z0-9_]*$/;

/** Comilla un identificador ya validado; nunca recibe texto libre. */
function quoteIdent(name: string): string {
  if (!IDENTIFIER.test(name)) {
    throw new Error(`Identificador de esquema no válido: ${name}`);
  }
  return `"${name}"`;
}

interface MigrationFile {
  /** Ruta relativa a la carpeta de migraciones; es la clave en schema_migrations. */
  name: string;
  path: string;
}

/**
 * Aplica archivos .sql a un esquema y recuerda cuáles ya aplicó en
 * <esquema>.schema_migrations. Siempre trabaja dentro de la transacción que
 * recibe: si un archivo falla, no queda nada a medias.
 */
export class MigrationRunner {
  constructor(private readonly dir: string) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  migratePlatform(trx: Transaction<any>): Promise<string[]> {
    return this.apply(trx, 'platform', ['platform']);
  }

  migrateTenant(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    trx: Transaction<any>,
    schema: string,
    modules: readonly string[],
  ): Promise<string[]> {
    if (!TENANT_SCHEMA.test(schema)) {
      throw new Error(`Esquema de tienda no válido: ${schema}`);
    }
    for (const module of modules) {
      if (!MODULE_NAME.test(module)) {
        throw new Error(`Módulo no válido: ${module}`);
      }
    }
    return this.apply(trx, schema, [
      'tenant/base',
      ...modules.map((module) => `tenant/modules/${module}`),
    ]);
  }

  /** Devuelve los nombres de las migraciones aplicadas en esta llamada. */
  private async apply(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    trx: Transaction<any>,
    schema: string,
    scopes: string[],
  ): Promise<string[]> {
    const target = quoteIdent(schema);

    // Evita que dos procesos migren el mismo esquema a la vez.
    await sql`select pg_advisory_xact_lock(hashtext(${schema}))`.execute(trx);
    await sql.raw(`create schema if not exists ${target}`).execute(trx);
    await sql
      .raw(
        `create table if not exists ${target}.schema_migrations (` +
          `name text primary key, applied_at timestamptz not null default now())`,
      )
      .execute(trx);

    const done = await sql<{ name: string }>`select name from ${sql.raw(target)}.schema_migrations`.execute(trx);
    const applied = new Set(done.rows.map((row) => row.name));

    const pending: MigrationFile[] = [];
    for (const scope of scopes) {
      for (const file of await this.list(scope)) {
        if (!applied.has(file.name)) pending.push(file);
      }
    }
    if (pending.length === 0) return [];

    // Los .sql usan nombres sin calificar: search_path decide en qué esquema caen.
    await sql.raw(`set local search_path to ${target}`).execute(trx);
    for (const file of pending) {
      await sql.raw(await readFile(file.path, 'utf8')).execute(trx);
      await sql`insert into ${sql.raw(target)}.schema_migrations (name) values (${file.name})`.execute(trx);
    }
    await sql.raw('set local search_path to default').execute(trx);

    return pending.map((file) => file.name);
  }

  private async list(scope: string): Promise<MigrationFile[]> {
    const folder = join(this.dir, ...scope.split('/'));
    let entries: string[];
    try {
      entries = await readdir(folder);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`No existe la carpeta de migraciones ${folder}`);
      }
      throw error;
    }
    return entries
      .filter((entry) => entry.endsWith('.sql'))
      .sort()
      .map((entry) => ({ name: `${scope}/${entry}`, path: join(folder, entry) }));
  }
}
