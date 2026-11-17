import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  type CompiledQuery,
  type Driver,
} from 'kysely';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MigrationRunner } from './migration-runner';

/** Base de datos simulada: anota el SQL recibido y recuerda las migraciones aplicadas. */
class FakeDatabase {
  readonly log: string[] = [];
  readonly applied: string[] = [];

  readonly db = new Kysely<unknown>({
    dialect: {
      createAdapter: () => new PostgresAdapter(),
      createDriver: () => this.driver(),
      createIntrospector: (db) => new PostgresIntrospector(db),
      createQueryCompiler: () => new PostgresQueryCompiler(),
    },
  });

  private driver(): Driver {
    const connection = {
      executeQuery: async (query: CompiledQuery) => {
        this.log.push(query.sql);
        if (query.sql.startsWith('select name from')) {
          return { rows: this.applied.map((name) => ({ name })) };
        }
        if (query.sql.startsWith('insert into')) {
          this.applied.push(query.parameters[0] as string);
        }
        return { rows: [] };
      },
      // eslint-disable-next-line require-yield
      streamQuery: async function* () {
        throw new Error('no usado');
      },
    };
    return {
      init: async () => undefined,
      acquireConnection: async () => connection as never,
      beginTransaction: async () => void this.log.push('BEGIN'),
      commitTransaction: async () => void this.log.push('COMMIT'),
      rollbackTransaction: async () => void this.log.push('ROLLBACK'),
      releaseConnection: async () => undefined,
      destroy: async () => undefined,
    };
  }
}

describe('MigrationRunner', () => {
  let dir: string;
  let fake: FakeDatabase;
  let runner: MigrationRunner;

  async function file(relative: string, content: string) {
    const path = join(dir, relative);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content);
  }

  const migrate = (schema: string, modules: string[]) =>
    fake.db
      .transaction()
      .execute((trx) => runner.migrateTenant(trx, schema, modules));

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'o-stores-migrations-'));
    fake = new FakeDatabase();
    runner = new MigrationRunner(dir);
    await file('tenant/base/0002_b.sql', 'create table b ()');
    await file('tenant/base/0001_a.sql', 'create table a ()');
    await file('tenant/base/README.md', 'no es una migración');
    await file('tenant/modules/tcg/0001_sets.sql', 'create table sets ()');
    await file('platform/0001_init.sql', 'create table stores ()');
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('aplica en orden la base y luego los módulos activos', async () => {
    const applied = await migrate('tenant_demo', ['tcg']);

    expect(applied).toEqual([
      'tenant/base/0001_a.sql',
      'tenant/base/0002_b.sql',
      'tenant/modules/tcg/0001_sets.sql',
    ]);
    expect(fake.log).toContain('create schema if not exists "tenant_demo"');
    const body = fake.log.filter((sql) => sql.startsWith('create table '));
    expect(body.slice(-3)).toEqual([
      'create table a ()',
      'create table b ()',
      'create table sets ()',
    ]);
  });

  it('fija search_path al esquema antes de ejecutar los archivos', async () => {
    await migrate('tenant_demo', []);

    const setPath = fake.log.indexOf('set local search_path to "tenant_demo"');
    const firstFile = fake.log.indexOf('create table a ()');
    expect(setPath).toBeGreaterThan(-1);
    expect(setPath).toBeLessThan(firstFile);
    expect(fake.log.at(-1)).toBe('COMMIT');
  });

  it('no repite lo ya aplicado y solo añade lo nuevo', async () => {
    await migrate('tenant_demo', []);
    expect(await migrate('tenant_demo', [])).toEqual([]);

    // Activar un módulo después solo aplica las migraciones de ese módulo.
    expect(await migrate('tenant_demo', ['tcg'])).toEqual([
      'tenant/modules/tcg/0001_sets.sql',
    ]);
  });

  it('migra platform con sus propios archivos', async () => {
    const applied = await fake.db
      .transaction()
      .execute((trx) => runner.migratePlatform(trx));
    expect(applied).toEqual(['platform/0001_init.sql']);
  });

  it('rechaza esquemas y módulos con nombres no válidos', async () => {
    await expect(migrate('public', [])).rejects.toThrow('no válido');
    await expect(migrate('tenant_x"; drop schema platform', [])).rejects.toThrow(
      'no válido',
    );
    await expect(migrate('tenant_demo', ['../platform'])).rejects.toThrow(
      'no válido',
    );
  });

  it('falla con un mensaje claro si el módulo no tiene carpeta', async () => {
    await expect(migrate('tenant_demo', ['apparel'])).rejects.toThrow(
      'No existe la carpeta de migraciones',
    );
    expect(fake.log.at(-1)).toBe('ROLLBACK');
  });
});
