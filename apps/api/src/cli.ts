import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { DatabaseService } from './database/database.service';
import { MigrationRunner } from './database/migration-runner';
import { MembershipsService } from './memberships/memberships.module';

/**
 * Tareas de mantenimiento que reutilizan los servicios de la API sin levantar
 * el servidor HTTP:
 *   --migrate                       aplica migraciones a platform y a cada tienda
 *   --grant-super-admin <correo>    da el rol super_admin a una cuenta existente
 */
export async function runCli(args: string[]): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  try {
    if (args[0] === '--migrate') {
      await migrateAll(app.get(DatabaseService), app.get(MigrationRunner));
    } else if (args[0] === '--grant-super-admin' && args[1]) {
      await app.get(MembershipsService).grantSuperAdmin(args[1]);
      console.log(`${args[1]} ahora es super_admin`);
    } else {
      throw new Error(`Comando no reconocido: ${args.join(' ')}`);
    }
  } finally {
    await app.close();
  }
}

async function migrateAll(
  database: DatabaseService,
  runner: MigrationRunner,
): Promise<void> {
  const report = (target: string, applied: string[]) =>
    console.log(
      applied.length
        ? `${target}: aplicadas ${applied.join(', ')}`
        : `${target}: al día`,
    );

  report(
    'platform',
    await database.db
      .transaction()
      .execute((trx) => runner.migratePlatform(trx)),
  );

  const stores = await database.db
    .selectFrom('platform.stores')
    .select(['schemaName', 'modules', 'dbUrl'])
    .orderBy('schemaName')
    .execute();
  for (const store of stores) {
    report(
      store.schemaName,
      await database
        .forStore(store)
        .transaction()
        .execute((trx) =>
          runner.migrateTenant(trx, store.schemaName, store.modules),
        ),
    );
  }
}
