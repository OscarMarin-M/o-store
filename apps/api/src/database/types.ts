import type { Role } from '@o-stores/contracts';
import type { Generated } from 'kysely';

// Tipos de las tablas tal como las ve Kysely. Los nombres van en camelCase:
// CamelCasePlugin los traduce a snake_case al generar el SQL.

export interface StoresTable {
  id: Generated<string>;
  slug: string;
  name: string;
  enabled: Generated<boolean>;
  modules: Generated<string[]>;
  schemaName: string;
  dbUrl: string | null;
  logoPath: string | null;
  colorPrimary: Generated<string>;
  colorAccent: Generated<string>;
  colorBackground: Generated<string>;
  theme: Generated<Record<string, unknown>>;
  createdAt: Generated<Date>;
  updatedAt: Generated<Date>;
}

export interface StoreDomainsTable {
  id: Generated<string>;
  storeId: string;
  domain: string;
  isPrimary: Generated<boolean>;
  verified: Generated<boolean>;
  createdAt: Generated<Date>;
}

export interface MembershipsTable {
  id: Generated<string>;
  userId: string;
  storeId: string | null;
  role: Role;
  createdAt: Generated<Date>;
}

/** Tabla de Supabase Auth; solo lectura desde la API. */
export interface AuthUsersTable {
  id: string;
  email: string | null;
}

export interface DB {
  'platform.stores': StoresTable;
  'platform.storeDomains': StoreDomainsTable;
  'platform.memberships': MembershipsTable;
  'auth.users': AuthUsersTable;
}
