import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type {
  ProductDto,
  ProductImageUploadDto,
  ProductInput,
  ProductListDto,
  ProductListQuery,
  ProductStatus,
  StoreSettingsDto,
  UpdateStoreSettingsInput,
} from '@o-stores/contracts';
import { sql, type Selectable, type Transaction } from 'kysely';
import { randomUUID } from 'node:crypto';
import { isUniqueViolation } from '../common/pg-errors';
import { AppConfig, STORE_ASSETS_BUCKET } from '../config/app-config';
import { SUPABASE_ADMIN, type SupabaseAdmin } from '../database/database.module';
import type { ProductVariantsTable, ProductsTable, TenantDB } from '../database/types';
import { productCode, productSlug, variantCode } from '@o-stores/contracts';
import { TenantDbService, type Tenant } from './tenant-db.service';

const PAGE_SIZE = 50;

type ProductRow = Selectable<ProductsTable>;
type VariantRow = Selectable<ProductVariantsTable>;

@Injectable()
export class ProductsService {
  constructor(
    private readonly tenants: TenantDbService,
    private readonly config: AppConfig,
    @Inject(SUPABASE_ADMIN) private readonly supabase: SupabaseAdmin,
  ) {}

  // ---- Ajustes ----

  async getSettings(storeId: string): Promise<StoreSettingsDto> {
    const { db } = await this.tenants.forStore(storeId);
    const row = await db
      .selectFrom('settings')
      .select(['currency', 'productCodePrefix'])
      .executeTakeFirstOrThrow();
    return row;
  }

  async updateSettings(storeId: string, input: UpdateStoreSettingsInput): Promise<StoreSettingsDto> {
    const { db } = await this.tenants.forStore(storeId);
    if (Object.keys(input).length) {
      await db
        .updateTable('settings')
        .set({ ...input, updatedAt: new Date() })
        .execute();
    }
    return this.getSettings(storeId);
  }

  // ---- Productos ----

  async list(storeId: string, query: ProductListQuery): Promise<ProductListDto> {
    const { db } = await this.tenants.forStore(storeId);
    let base = db.selectFrom('products as p');
    if (query.status) {
      base = base.where('p.status', '=', query.status);
    } else {
      // Sin filtro, lo archivado no aparece: para eso está el filtro "Archivados".
      base = base.where('p.status', '!=', 'archived');
    }
    if (query.q) {
      const term = `%${query.q.replace(/[%_\\]/g, '\\$&')}%`;
      base = base.where((eb) =>
        eb.or([eb('p.name', 'ilike', term), eb('p.code', 'ilike', term)]),
      );
    }

    const [{ total }, rows] = await Promise.all([
      base.select((eb) => eb.fn.countAll<string>().as('total')).executeTakeFirstOrThrow(),
      base
        .select([
          'p.id',
          'p.code',
          'p.name',
          'p.status',
          'p.price',
          'p.priceCurrency',
          'p.stock',
          'p.images',
          'p.updatedAt',
        ])
        .select((eb) => [
          eb
            .selectFrom('productVariants as v')
            .whereRef('v.productId', '=', 'p.id')
            .select(eb.fn.countAll<string>().as('n'))
            .as('variantCount'),
          eb
            .selectFrom('productVariants as v')
            .whereRef('v.productId', '=', 'p.id')
            .select(sql<string>`coalesce(sum(v.stock), 0)`.as('s'))
            .as('variantStock'),
        ])
        .orderBy('p.updatedAt', 'desc')
        .limit(PAGE_SIZE)
        .offset((query.page - 1) * PAGE_SIZE)
        .execute(),
    ]);

    return {
      items: rows.map((r) => {
        const variantCount = Number(r.variantCount ?? 0);
        return {
          id: r.id,
          code: r.code,
          name: r.name,
          status: r.status,
          price: Number(r.price),
          priceCurrency: r.priceCurrency,
          totalStock: variantCount ? Number(r.variantStock ?? 0) : r.stock,
          variantCount,
          coverUrl: this.config.publicAssetUrl(r.images[0] ?? null),
          updatedAt: r.updatedAt.toISOString(),
        };
      }),
      total: Number(total),
      page: query.page,
      pageSize: PAGE_SIZE,
    };
  }

  async get(storeId: string, productId: string): Promise<ProductDto> {
    const tenant = await this.tenants.forStore(storeId);
    return this.load(tenant.db, productId);
  }

  async create(storeId: string, input: ProductInput): Promise<ProductDto> {
    const tenant = await this.tenants.forStore(storeId);
    this.checkImages(storeId, input.images);
    const id = await this.write(tenant, input, async (trx) => {
      const code = input.code ?? (await this.nextCode(trx, tenant.schema));
      const row = await trx
        .withSchema(tenant.schema)
        .insertInto('products')
        .values({
          ...this.productValues(input),
          code,
          slug: productSlug(input.name, code),
        })
        .returning(['id', 'code'])
        .executeTakeFirstOrThrow();
      await this.syncVariants(trx, tenant.schema, row.id, row.code, input);
      return row.id;
    });
    return this.load(tenant.db, id);
  }

  async update(storeId: string, productId: string, input: ProductInput): Promise<ProductDto> {
    const tenant = await this.tenants.forStore(storeId);
    this.checkImages(storeId, input.images);
    await this.write(tenant, input, async (trx) => {
      const current = await trx
        .withSchema(tenant.schema)
        .selectFrom('products')
        .select(['id', 'code'])
        .where('id', '=', productId)
        .executeTakeFirst();
      if (!current) throw new NotFoundException('Producto no encontrado');
      const code = input.code ?? current.code;
      // La dirección no cambia al renombrar: los enlaces ya compartidos siguen sirviendo.
      await trx
        .withSchema(tenant.schema)
        .updateTable('products')
        .set({ ...this.productValues(input), code, updatedAt: new Date() })
        .where('id', '=', productId)
        .execute();
      await this.syncVariants(trx, tenant.schema, productId, code, input);
      return productId;
    });
    return this.load(tenant.db, productId);
  }

  /** Archivar en vez de borrar: los pedidos antiguos siguen sabiendo qué se vendió. */
  async setStatus(storeId: string, productId: string, status: ProductStatus): Promise<ProductDto> {
    const { db } = await this.tenants.forStore(storeId);
    const result = await db
      .updateTable('products')
      .set({ status, updatedAt: new Date() })
      .where('id', '=', productId)
      .executeTakeFirst();
    if (result.numUpdatedRows === 0n) throw new NotFoundException('Producto no encontrado');
    return this.load(db, productId);
  }

  /** URL firmada para subir una foto de producto directo a Storage. */
  async createImageUpload(storeId: string, extension: string): Promise<ProductImageUploadDto> {
    await this.tenants.forStore(storeId);
    const path = `${storeId}/products/${randomUUID()}.${extension}`;
    const { data, error } = await this.supabase.storage
      .from(STORE_ASSETS_BUCKET)
      .createSignedUploadUrl(path);
    if (error || !data) {
      throw new InternalServerErrorException('No se pudo preparar la subida de la foto');
    }
    return { path: data.path, signedUrl: data.signedUrl };
  }

  // ---- Interno ----

  private productValues(input: ProductInput) {
    return {
      name: input.name,
      description: input.description,
      price: input.price,
      priceCurrency: input.priceCurrency,
      // Con variantes, el stock vive en cada variante.
      stock: input.optionNames.length ? 0 : input.stock,
      status: input.status,
      categoryId: input.categoryId,
      images: input.images,
      optionNames: input.optionNames,
    };
  }

  private async nextCode(trx: Transaction<TenantDB>, schema: string): Promise<string> {
    const { productCodePrefix } = await trx
      .withSchema(schema)
      .selectFrom('settings')
      .select('productCodePrefix')
      .executeTakeFirstOrThrow();
    // Si alguien ya puso a mano un código como TCG-0005, el contador lo salta.
    for (let attempt = 0; attempt < 20; attempt++) {
      const { rows } = await sql<{ n: string }>`select nextval(${`${schema}.product_code_seq`}::regclass) as n`.execute(trx);
      const code = productCode(productCodePrefix, rows[0].n);
      const taken = await trx
        .withSchema(schema)
        .selectFrom('products')
        .select('id')
        .where('code', '=', code)
        .executeTakeFirst();
      if (!taken) return code;
    }
    throw new ConflictException('No se encontró un código libre; escribe uno a mano');
  }

  /**
   * Deja las variantes como en `input`: actualiza las que ya existían (misma
   * combinación, mismo id), crea las nuevas y borra las que ya no están.
   */
  private async syncVariants(
    trx: Transaction<TenantDB>,
    schema: string,
    productId: string,
    code: string,
    input: ProductInput,
  ): Promise<void> {
    const db = trx.withSchema(schema);
    const existing = await db
      .selectFrom('productVariants')
      .select(['id', 'optionValues'])
      .where('productId', '=', productId)
      .execute();
    const wanted = new Set(input.variants.map((v) => v.optionValues.join('\u0000')));
    const stale = existing
      .filter((v) => !wanted.has(v.optionValues.join('\u0000')))
      .map((v) => v.id);
    if (stale.length) {
      await db.deleteFrom('productVariants').where('id', 'in', stale).execute();
    }

    for (const [position, v] of input.variants.entries()) {
      await db
        .insertInto('productVariants')
        .values({
          productId,
          code: variantCode(code, v.optionValues),
          optionValues: v.optionValues,
          price: v.price,
          stock: v.stock,
          position,
        })
        .onConflict((oc) =>
          oc.columns(['productId', 'optionValues']).doUpdateSet((eb) => ({
            code: eb.ref('excluded.code'),
            price: eb.ref('excluded.price'),
            stock: eb.ref('excluded.stock'),
            position: eb.ref('excluded.position'),
            updatedAt: new Date(),
          })),
        )
        .execute();
    }
  }

  /** Ejecuta una escritura en transacción y traduce los choques de código únicos. */
  private async write(
    tenant: Tenant,
    input: ProductInput,
    work: (trx: Transaction<TenantDB>) => Promise<string>,
  ): Promise<string> {
    try {
      return await tenant.conn.transaction().execute(work);
    } catch (error) {
      if (isUniqueViolation(error)) {
        const constraint = (error as { constraint?: string }).constraint ?? '';
        throw new ConflictException(
          constraint.startsWith('product_variants')
            ? 'Dos variantes producen el mismo código; cambia alguno de sus valores'
            : `El código ${input.code ?? ''} ya lo usa otro producto; elige otro`,
        );
      }
      throw error;
    }
  }

  private checkImages(storeId: string, images: string[]): void {
    const prefix = `${storeId}/products/`;
    if (images.some((path) => !path.startsWith(prefix))) {
      throw new BadRequestException('Alguna foto no pertenece a esta tienda');
    }
  }

  private async load(db: Tenant['db'], productId: string): Promise<ProductDto> {
    const row = await db
      .selectFrom('products')
      .selectAll()
      .where('id', '=', productId)
      .executeTakeFirst();
    if (!row) throw new NotFoundException('Producto no encontrado');
    const variants = await db
      .selectFrom('productVariants')
      .selectAll()
      .where('productId', '=', productId)
      .orderBy('position')
      .execute();
    return this.toDto(row, variants);
  }

  private toDto(row: ProductRow, variants: VariantRow[]): ProductDto {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      slug: row.slug,
      description: row.description,
      price: Number(row.price),
      priceCurrency: row.priceCurrency,
      stock: row.stock,
      status: row.status,
      categoryId: row.categoryId,
      images: row.images.map((path) => ({
        path,
        url: this.config.publicAssetUrl(path) ?? '',
      })),
      optionNames: row.optionNames,
      variants: variants.map((v) => ({
        id: v.id,
        code: v.code,
        optionValues: v.optionValues,
        price: v.price === null ? null : Number(v.price),
        stock: v.stock,
      })),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
