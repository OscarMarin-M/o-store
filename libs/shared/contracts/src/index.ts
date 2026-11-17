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
  /** Subdominio incluido: <slug>.<dominio de la plataforma>. Siempre activo. */
  platformDomain: string;
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
  /** Registro TXT que el dueño debe crear para verificar el dominio. */
  verificationName: string;
  verificationValue: string;
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

/** Configuración pública para los front (GET /api/public/config). */
export interface ClientConfigDto {
  supabaseUrl: string;
  supabasePublishableKey: string;
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
  /**
   * Dirección canónica: el dominio propio principal (verificado) o, si no hay,
   * el subdominio de la plataforma. Si el host pedido es otro, la tienda
   * redirige aquí con un 301.
   */
  primaryDomain: string;
  modules: string[];
  logoUrl: string | null;
  colorPrimary: string;
  colorAccent: string;
  colorBackground: string;
  theme: Record<string, unknown>;
}

// ---- Catálogo ----

export const CURRENCIES = ['BOB', 'USD'] as const;
export type Currency = (typeof CURRENCIES)[number];

export const PRODUCT_STATUSES = ['draft', 'active', 'archived'] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

const productCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9][A-Z0-9-]{0,39}$/, 'Letras, números y guiones, hasta 40 caracteres');

const money = z.number({ error: 'Escribe un importe, por ejemplo 120 o 15,50' }).min(0, 'No puede ser negativo').max(9_999_999_999.99).multipleOf(0.01, 'Máximo dos decimales');
const stock = z.number({ error: 'Escribe un número entero, 0 o más' }).int('Debe ser un número entero').min(0, 'No puede ser negativo');

export const variantInputSchema = z.strictObject({
  /** Valores en el orden de optionNames: ["M", "Negro"]. */
  optionValues: z.array(z.string().trim().min(1).max(40)).min(1).max(3),
  /** null = usa el precio del producto. */
  price: money.nullable().default(null),
  stock: stock.default(0),
});
export type VariantInput = z.infer<typeof variantInputSchema>;

export const productInputSchema = z
  .strictObject({
    name: z.string().trim().min(1, 'Escribe el nombre').max(160),
    /** Vacío = se genera con el prefijo de la tienda. */
    code: productCode.optional(),
    description: z.string().trim().max(5000).nullable().default(null),
    price: money,
    priceCurrency: z.enum(CURRENCIES).default('BOB'),
    /** Solo cuenta si el producto no tiene variantes. */
    stock: stock.default(0),
    status: z.enum(PRODUCT_STATUSES).default('draft'),
    categoryId: z.uuid().nullable().default(null),
    /** Rutas en Storage; la primera es la portada. */
    images: z.array(z.string().max(300)).max(12).default([]),
    optionNames: z.array(z.string().trim().min(1).max(30)).max(3).default([]),
    variants: z.array(variantInputSchema).max(100).default([]),
  })
  .superRefine((p, ctx) => {
    const names = p.optionNames.map((n) => n.toLowerCase());
    if (new Set(names).size !== names.length) {
      ctx.addIssue({ code: 'custom', path: ['optionNames'], message: 'Las opciones no pueden repetirse' });
    }
    const seen = new Set<string>();
    p.variants.forEach((v, i) => {
      if (v.optionValues.length !== p.optionNames.length) {
        ctx.addIssue({ code: 'custom', path: ['variants', i], message: 'Cada variante necesita un valor por opción' });
      }
      const key = v.optionValues.map((x) => x.toLowerCase()).join('\u0000');
      if (seen.has(key)) {
        ctx.addIssue({ code: 'custom', path: ['variants', i], message: 'Esta combinación está repetida' });
      }
      seen.add(key);
    });
    if (p.optionNames.length && !p.variants.length) {
      ctx.addIssue({ code: 'custom', path: ['variants'], message: 'Añade al menos una variante o quita las opciones' });
    }
  });
export type ProductInput = z.infer<typeof productInputSchema>;

export const productListQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(PRODUCT_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
});
export type ProductListQuery = z.infer<typeof productListQuerySchema>;

export const productImageUploadSchema = z.strictObject({
  extension: z.enum(['png', 'jpg', 'jpeg', 'webp']),
});
export type ProductImageUploadInput = z.infer<typeof productImageUploadSchema>;

export const updateStoreSettingsSchema = z.strictObject({
  currency: z.enum(CURRENCIES).optional(),
  productCodePrefix: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{1,8}$/, 'De 1 a 8 letras o números, sin espacios')
    .optional(),
});
export type UpdateStoreSettingsInput = z.infer<typeof updateStoreSettingsSchema>;

export interface StoreSettingsDto {
  currency: Currency;
  productCodePrefix: string;
}

export interface ProductVariantDto {
  id: string;
  code: string;
  optionValues: string[];
  price: number | null;
  stock: number;
}

export interface ProductImageDto {
  path: string;
  url: string;
}

export interface ProductDto {
  id: string;
  code: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  priceCurrency: Currency;
  stock: number;
  status: ProductStatus;
  categoryId: string | null;
  images: ProductImageDto[];
  optionNames: string[];
  variants: ProductVariantDto[];
  createdAt: string;
  updatedAt: string;
}

export interface ProductListItemDto {
  id: string;
  code: string;
  name: string;
  status: ProductStatus;
  price: number;
  priceCurrency: Currency;
  /** Stock del producto o suma de sus variantes. */
  totalStock: number;
  variantCount: number;
  coverUrl: string | null;
  updatedAt: string;
}

export interface ProductListDto {
  items: ProductListItemDto[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ProductImageUploadDto {
  path: string;
  signedUrl: string;
}

/** Tipo de cambio oficial: 1 USD = rate BOB. */
export interface ExchangeRateDto {
  base: 'USD';
  quote: 'BOB';
  rate: number;
  /** De dónde salió: 'manual' (variable de entorno) o 'bcb'. */
  source: string;
  fetchedAt: string;
}

export const setProductStatusSchema = z.strictObject({ status: z.enum(PRODUCT_STATUSES) });
export type SetProductStatusInput = z.infer<typeof setProductStatusSchema>;
export * from './codes';
