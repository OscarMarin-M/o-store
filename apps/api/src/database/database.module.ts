import { Global, Module } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppConfig } from '../config/app-config';
import { DatabaseService } from './database.service';
import { MigrationRunner } from './migration-runner';

/** Cliente de Supabase con la clave secreta: invitaciones y URLs firmadas de Storage. */
export const SUPABASE_ADMIN = Symbol('SUPABASE_ADMIN');
export type SupabaseAdmin = SupabaseClient;

@Global()
@Module({
  providers: [
    AppConfig,
    DatabaseService,
    {
      provide: MigrationRunner,
      useFactory: (config: AppConfig) => new MigrationRunner(config.migrationsDir),
      inject: [AppConfig],
    },
    {
      provide: SUPABASE_ADMIN,
      useFactory: (config: AppConfig) =>
        createClient(config.supabaseUrl, config.supabaseSecretKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        }),
      inject: [AppConfig],
    },
  ],
  exports: [AppConfig, DatabaseService, MigrationRunner, SUPABASE_ADMIN],
})
export class DatabaseModule {}
