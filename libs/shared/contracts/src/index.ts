import { z } from 'zod';

// ---- Roles ----

export const ROLES = ['super_admin', 'store_owner', 'store_staff'] as const;
export type Role = (typeof ROLES)[number];

/** Roles que se asignan dentro de una tienda (super_admin es de plataforma). */
export const STORE_ROLES = ['store_owner', 'store_staff'] as const;
export type StoreRole = (typeof STORE_ROLES)[number];

// ---- Módulos ----

/** Debe coincidir con las carpetas de db/migrations/tenant/modules. */
export const STORE_MODULES = ['tcg', 'apparel'] as const;
export type StoreModule = (typeof STORE_MODULES)[number];

// ---- Esquemas de entrada (validan en la API y en los formularios) ----

const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Color hexadecimal de 6 dígitos, por ejemplo #1a2b3c');

const modules = z
  .array(z.enum(STORE_MODULES))
  .transform((list) => [...new Set(list)]);

export const createStoreSchema = z.strictObject({
  name: z.string().trim().min(1).max(80),
  slug: z
    .string()
    .regex(
      /^[a-z][a-z0-9-]{1,38}[a-z0-9]$/,
      'De 3 a 40 caracteres: minúsculas, números y guiones; empieza con letra',
    ),
  modules: modules.default([]),
});
export type CreateStoreInput = z.infer<typeof createStoreSchema>;

export const updateStoreSchema = z.strictObject({
  name: z.string().trim().min(1).max(80).optional(),
  logoPath: z.string().max(300).nullable().optional(),
  colorPrimary: hexColor.optional(),
  colorAccent: hexColor.optional(),
  colorBackground: hexColor.optional(),
  theme: z.record(z.string(), z.unknown()).optional(),
});
export type UpdateStoreInput = z.infer<typeof updateStoreSchema>;

export const setStoreEnabledSchema = z.strictObject({ enabled: z.boolean() });
export type SetStoreEnabledInput = z.infer<typeof setStoreEnabledSchema>;

export const setStoreModulesSchema = z.strictObject({ modules });
export type SetStoreModulesInput = z.infer<typeof setStoreModulesSchema>;

const domain = z
  .string()
  .trim()
  .toLowerCase()
  .max(253)
  .regex(
    /^(localhost|([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63})$/,
    'Dominio sin protocolo ni puerto, por ejemplo tienda.com',
  );

export const createDomainSchema = z.strictObject({
  domain,
  isPrimary: z.boolean().default(false),
});
export type CreateDomainInput = z.infer<typeof createDomainSchema>;

export const updateDomainSchema = z.strictObject({
  isPrimary: z.literal(true).optional(),
  /** Solo lo aplica un super_admin. */
  verified: z.boolean().optional(),
});
export type UpdateDomainInput = z.infer<typeof updateDomainSchema>;

export const logoUploadSchema = z.strictObject({
  extension: z.enum(['png', 'jpg', 'jpeg', 'webp']),
});
export type LogoUploadInput = z.infer<typeof logoUploadSchema>;

export const addMemberSchema = z.strictObject({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  role: z.enum(STORE_ROLES),
});
export type AddMemberInput = z.infer<typeof addMemberSchema>;

export const updateMemberSchema = z.strictObject({ role: z.enum(STORE_ROLES) });
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;

// ---- Respuestas de la API ----

export interface StoreDto {
  id: string;
  slug: string;
  name: string;
  enabled: boolean;
  modules: string[];
  schemaName: string;
  logoPath: string | null;
  logoUrl: string | null;
  colorPrimary: string;
  colorAccent: string;
  colorBackground: string;
  theme: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface StoreDomainDto {
  id: string;
  storeId: string;
  domain: string;
  isPrimary: boolean;
  verified: boolean;
  createdAt: string;
}

export interface MemberDto {
  id: string;
  userId: string;
  email: string | null;
  role: StoreRole;
  createdAt: string;
}

export interface MembershipDto {
  storeId: string | null;
  role: Role;
}

export interface MeDto {
  id: string;
  email: string | null;
  isSuperAdmin: boolean;
  memberships: MembershipDto[];
}

export interface LogoUploadDto {
  bucket: string;
  path: string;
  token: string;
  signedUrl: string;
}

/** Lo que una tienda pública necesita para pintarse; sin datos internos. */
export interface PublicStoreDto {
  id: string;
  slug: string;
  name: string;
  modules: string[];
  logoUrl: string | null;
  colorPrimary: string;
  colorAccent: string;
  colorBackground: string;
  theme: Record<string, unknown>;
}
