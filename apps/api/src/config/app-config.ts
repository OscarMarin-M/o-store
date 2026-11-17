import { Injectable } from '@nestjs/common';
import { resolve } from 'node:path';

export const STORE_ASSETS_BUCKET = 'store-assets';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name} (ver .env.example)`);
  }
  return value;
}

/** Configuración leída del entorno una sola vez, al arrancar. */
@Injectable()
export class AppConfig {
  readonly supabaseUrl = required('SUPABASE_URL').replace(/\/+$/, '');
  readonly supabasePublishableKey = required('SUPABASE_PUBLISHABLE_KEY');
  readonly supabaseSecretKey = required('SUPABASE_SECRET_KEY');
  readonly databaseUrl = required('DATABASE_URL');
  /** Solo para proyectos Supabase antiguos que firman los JWT con secreto compartido (HS256). */
  readonly supabaseJwtSecret = process.env['SUPABASE_JWT_SECRET']?.trim() || null;
  readonly migrationsDir = resolve(
    process.env['MIGRATIONS_DIR']?.trim() || 'db/migrations',
  );

  publicAssetUrl(path: string | null): string | null {
    return path
      ? `${this.supabaseUrl}/storage/v1/object/public/${STORE_ASSETS_BUCKET}/${path}`
      : null;
  }
}
