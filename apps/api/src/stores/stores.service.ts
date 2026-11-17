import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type {
  CreateDomainInput,
  CreateStoreInput,
  LogoUploadDto,
  PublicStoreDto,
  StoreDomainDto,
  StoreDto,
  UpdateDomainInput,
  UpdateStoreInput,
} from '@o-stores/contracts';
import type { Selectable } from 'kysely';
import { MembershipLookup } from '../auth/membership-lookup';
import { isUniqueViolation } from '../common/pg-errors';
import { AppConfig, STORE_ASSETS_BUCKET } from '../config/app-config';
import {
  SUPABASE_ADMIN,
  type SupabaseAdmin,
} from '../database/database.module';
import { DatabaseService } from '../database/database.service';
import { MigrationRunner } from '../database/migration-runner';
import type { StoreDomainsTable, StoresTable } from '../database/types';

type StoreRow = Selectable<StoresTable>;
type DomainRow = Selectable<StoreDomainsTable>;

@Injectable()
export class StoresService {
  constructor(
    private readonly database: DatabaseService,
    private readonly runner: MigrationRunner,
    private readonly lookup: MembershipLookup,
    private readonly config: AppConfig,
    @Inject(SUPABASE_ADMIN) private readonly supabase: SupabaseAdmin,
  ) {}

  private get db() {
    return this.database.db;
  }

  // ---- Tiendas ----

  /** Un super_admin ve todas; el resto, solo las tiendas donde tiene membresía. */
  async listFor(userId: string): Promise<StoreDto[]> {
    const access = await this.lookup.accessFor(userId);
    let query = this.db
      .selectFrom('platform.stores')
      .selectAll()
      .orderBy('name');
    if (!access.isSuperAdmin) {
      const ids = access.memberships
        .map((m) => m.storeId)
        .filter((id): id is string => id !== null);
      if (ids.length === 0) return [];
      query = query.where('id', 'in', ids);
    }
    return (await query.execute()).map((row) => this.toDto(row));
  }

  async get(storeId: string): Promise<StoreDto> {
    return this.toDto(await this.getRow(storeId));
  }

  /** Crea la fila, el esquema tenant_<slug> y sus tablas en una sola transacción. */
  async create(input: CreateStoreInput): Promise<StoreDto> {
    const schemaName = `tenant_${input.slug.replace(/-/g, '_')}`;
    try {
      const row = await this.db.transaction().execute(async (trx) => {
        const created = await trx
          .insertInto('platform.stores')
          .values({
            name: input.name,
            slug: input.slug,
            modules: input.modules,
            schemaName,
          })
          .returningAll()
          .executeTakeFirstOrThrow();
        await this.runner.migrateTenant(trx, schemaName, input.modules);
        return created;
      });
      return this.toDto(row);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Ya existe una tienda con ese slug');
      }
      throw error;
    }
  }

  async update(storeId: string, input: UpdateStoreInput): Promise<StoreDto> {
    if (input.logoPath && !input.logoPath.startsWith(`${storeId}/`)) {
      throw new BadRequestException(
        'El logo debe estar en la carpeta de la tienda',
      );
    }
    const row = await this.db
      .updateTable('platform.stores')
      .set({ ...input, updatedAt: new Date() })
      .where('id', '=', storeId)
      .returningAll()
      .executeTakeFirst();
    if (!row) throw new NotFoundException('Tienda no encontrada');
    return this.toDto(row);
  }

  async setEnabled(storeId: string, enabled: boolean): Promise<StoreDto> {
    const row = await this.db
      .updateTable('platform.stores')
      .set({ enabled, updatedAt: new Date() })
      .where('id', '=', storeId)
      .returningAll()
      .executeTakeFirst();
    if (!row) throw new NotFoundException('Tienda no encontrada');
    return this.toDto(row);
  }

  /**
   * Activa o desactiva módulos. Activar aplica sus migraciones; desactivar no
   * borra tablas ni datos, solo deja de ofrecer el módulo.
   */
  async setModules(storeId: string, modules: string[]): Promise<StoreDto> {
    const store = await this.getRow(storeId);
    const set = (db: typeof this.db) =>
      db
        .updateTable('platform.stores')
        .set({ modules, updatedAt: new Date() })
        .where('id', '=', storeId)
        .returningAll()
        .executeTakeFirstOrThrow();

    if (store.dbUrl) {
      // Tienda en su propio proyecto: no hay transacción común entre las dos bases.
      await this.database
        .forStore(store)
        .transaction()
        .execute((trx) =>
          this.runner.migrateTenant(trx, store.schemaName, modules),
        );
      return this.toDto(await set(this.db));
    }
    const row = await this.db.transaction().execute(async (trx) => {
      await this.runner.migrateTenant(trx, store.schemaName, modules);
      return set(trx);
    });
    return this.toDto(row);
  }

  /** URL firmada para que el admin suba el logo directo a Storage. */
  async createLogoUpload(
    storeId: string,
    extension: string,
  ): Promise<LogoUploadDto> {
    await this.getRow(storeId);
    const path = `${storeId}/logo-${Date.now()}.${extension}`;
    const { data, error } = await this.supabase.storage
      .from(STORE_ASSETS_BUCKET)
      .createSignedUploadUrl(path);
    if (error || !data) {
      throw new InternalServerErrorException(
        'No se pudo preparar la subida del logo',
      );
    }
    return {
      bucket: STORE_ASSETS_BUCKET,
      path: data.path,
      token: data.token,
      signedUrl: data.signedUrl,
    };
  }

  // ---- Dominios ----

  async listDomains(storeId: string): Promise<StoreDomainDto[]> {
    const rows = await this.db
      .selectFrom('platform.storeDomains')
      .selectAll()
      .where('storeId', '=', storeId)
      .orderBy('isPrimary', 'desc')
      .orderBy('domain')
      .execute();
    return rows.map(toDomainDto);
  }

  async addDomain(
    storeId: string,
    input: CreateDomainInput,
  ): Promise<StoreDomainDto> {
    await this.getRow(storeId);
    try {
      const row = await this.db.transaction().execute(async (trx) => {
        if (input.isPrimary) {
          await trx
            .updateTable('platform.storeDomains')
            .set({ isPrimary: false })
            .where('storeId', '=', storeId)
            .execute();
        }
        return trx
          .insertInto('platform.storeDomains')
          .values({ storeId, domain: input.domain, isPrimary: input.isPrimary })
          .returningAll()
          .executeTakeFirstOrThrow();
      });
      return toDomainDto(row);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Ese dominio ya está en uso');
      }
      throw error;
    }
  }

  /** `verified` solo se aplica si quien lo pide es super_admin. */
  async updateDomain(
    storeId: string,
    domainId: string,
    input: UpdateDomainInput,
    isSuperAdmin: boolean,
  ): Promise<StoreDomainDto> {
    const changes: { isPrimary?: boolean; verified?: boolean } = {};
    if (input.isPrimary) changes.isPrimary = true;
    if (input.verified !== undefined && isSuperAdmin) {
      changes.verified = input.verified;
    }

    const row = await this.db.transaction().execute(async (trx) => {
      if (changes.isPrimary) {
        await trx
          .updateTable('platform.storeDomains')
          .set({ isPrimary: false })
          .where('storeId', '=', storeId)
          .execute();
      }
      const base = trx
        .selectFrom('platform.storeDomains')
        .selectAll()
        .where('id', '=', domainId)
        .where('storeId', '=', storeId);
      if (Object.keys(changes).length === 0) return base.executeTakeFirst();
      return trx
        .updateTable('platform.storeDomains')
        .set(changes)
        .where('id', '=', domainId)
        .where('storeId', '=', storeId)
        .returningAll()
        .executeTakeFirst();
    });
    if (!row) throw new NotFoundException('Dominio no encontrado');
    return toDomainDto(row);
  }

  async removeDomain(storeId: string, domainId: string): Promise<void> {
    const result = await this.db
      .deleteFrom('platform.storeDomains')
      .where('id', '=', domainId)
      .where('storeId', '=', storeId)
      .executeTakeFirst();
    if (result.numDeletedRows === 0n) {
      throw new NotFoundException('Dominio no encontrado');
    }
  }

  // ---- Público ----

  /** Tienda habilitada cuyo dominio verificado coincide con el host. */
  async resolveByHost(host: string): Promise<PublicStoreDto> {
    const domain = host.trim().toLowerCase().replace(/:\d+$/, '');
    const row = domain
      ? await this.db
          .selectFrom('platform.storeDomains as d')
          .innerJoin('platform.stores as s', 's.id', 'd.storeId')
          .selectAll('s')
          .where('d.domain', '=', domain)
          .where('d.verified', '=', true)
          .where('s.enabled', '=', true)
          .executeTakeFirst()
      : undefined;
    if (!row) throw new NotFoundException('Tienda no encontrada');
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      modules: row.modules,
      logoUrl: this.config.publicAssetUrl(row.logoPath),
      colorPrimary: row.colorPrimary,
      colorAccent: row.colorAccent,
      colorBackground: row.colorBackground,
      theme: row.theme,
    };
  }

  // ---- Interno ----

  private async getRow(storeId: string): Promise<StoreRow> {
    const row = await this.db
      .selectFrom('platform.stores')
      .selectAll()
      .where('id', '=', storeId)
      .executeTakeFirst();
    if (!row) throw new NotFoundException('Tienda no encontrada');
    return row;
  }

  /** Nunca incluye db_url: lleva la contraseña de la base de la tienda. */
  private toDto(row: StoreRow): StoreDto {
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      enabled: row.enabled,
      modules: row.modules,
      schemaName: row.schemaName,
      logoPath: row.logoPath,
      logoUrl: this.config.publicAssetUrl(row.logoPath),
      colorPrimary: row.colorPrimary,
      colorAccent: row.colorAccent,
      colorBackground: row.colorBackground,
      theme: row.theme,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

function toDomainDto(row: DomainRow): StoreDomainDto {
  return { ...row, createdAt: row.createdAt.toISOString() };
}
