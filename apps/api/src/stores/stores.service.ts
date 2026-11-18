import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { resolveTxt } from 'node:dns/promises';
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
import { DEFAULT_STORE_PRIMARY, similarShade } from '@o-stores/contracts';
import type { Selectable } from 'kysely';
import { MembershipLookup } from '../auth/membership-lookup';
import { isUniqueViolation } from '../common/pg-errors';
import {
  isPlatformDomain,
  normalizeHost,
  platformSlugFromHost,
  txtRecordsContain,
  verificationRecordName,
  verificationToken,
} from './domains';
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
            // El valor por defecto de la base es ámbar, reservado en el admin: se manda siempre.
            colorPrimary: input.colorPrimary ?? DEFAULT_STORE_PRIMARY,
            colorAccent: input.colorAccent ?? similarShade(input.colorPrimary ?? DEFAULT_STORE_PRIMARY),
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
    return rows.map((row) => toDomainDto(row, this.config.domainVerifySecret));
  }

  async addDomain(
    storeId: string,
    input: CreateDomainInput,
  ): Promise<StoreDomainDto> {
    await this.getRow(storeId);
    if (isPlatformDomain(input.domain, this.config.platformDomain)) {
      throw new BadRequestException(
        'Los subdominios de la plataforma se asignan solos; añade aquí solo un dominio propio',
      );
    }
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
      return toDomainDto(row, this.config.domainVerifySecret);
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

    if (changes.isPrimary && !changes.verified) {
      const current = await this.getDomainRow(storeId, domainId);
      if (!current.verified) {
        throw new BadRequestException(
          'Solo un dominio verificado puede ser el principal',
        );
      }
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
    return toDomainDto(row, this.config.domainVerifySecret);
  }

  /**
   * Busca en el DNS el TXT de verificación y, si está, marca el dominio como
   * verificado. Si no, explica qué falta.
   */
  async checkDomain(storeId: string, domainId: string): Promise<StoreDomainDto> {
    const row = await this.getDomainRow(storeId, domainId);
    if (row.verified) return toDomainDto(row, this.config.domainVerifySecret);

    const name = verificationRecordName(row.domain);
    const expected = verificationToken(this.config.domainVerifySecret, row.id);
    let records: string[][] = [];
    try {
      records = await this.resolveTxt(name);
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code !== 'ENOTFOUND' && code !== 'ENODATA') {
        throw new ServiceUnavailableException(
          'No se pudo consultar el DNS. Inténtalo en unos minutos',
        );
      }
    }
    if (!txtRecordsContain(records, expected)) {
      throw new BadRequestException(
        records.length
          ? `El registro ${name} existe pero su valor no coincide. Copia el valor exacto`
          : `Aún no encontramos el registro ${name}. Los cambios de DNS pueden tardar hasta unas horas`,
      );
    }
    const updated = await this.db
      .updateTable('platform.storeDomains')
      .set({ verified: true })
      .where('id', '=', row.id)
      .returningAll()
      .executeTakeFirstOrThrow();
    return toDomainDto(updated, this.config.domainVerifySecret);
  }

  /** Separado para poder simularlo en pruebas. */
  protected resolveTxt(name: string): Promise<string[][]> {
    return resolveTxt(name);
  }

  private async getDomainRow(storeId: string, domainId: string): Promise<DomainRow> {
    const row = await this.db
      .selectFrom('platform.storeDomains')
      .selectAll()
      .where('id', '=', domainId)
      .where('storeId', '=', storeId)
      .executeTakeFirst();
    if (!row) throw new NotFoundException('Dominio no encontrado');
    return row;
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

  /**
   * Tienda habilitada para un host: primero un dominio propio verificado,
   * luego el subdominio de la plataforma (<slug>.<platformDomain>).
   */
  async resolveByHost(host: string): Promise<PublicStoreDto> {
    const domain = normalizeHost(host);
    const slug = platformSlugFromHost(domain, this.config.platformDomain);
    const row = !domain
      ? undefined
      : ((await this.db
          .selectFrom('platform.storeDomains as d')
          .innerJoin('platform.stores as s', 's.id', 'd.storeId')
          .selectAll('s')
          .where('d.domain', '=', domain)
          .where('d.verified', '=', true)
          .where('s.enabled', '=', true)
          .executeTakeFirst()) ??
        (slug
          ? await this.db
              .selectFrom('platform.stores')
              .selectAll()
              .where('slug', '=', slug)
              .where('enabled', '=', true)
              .executeTakeFirst()
          : undefined));
    if (!row) throw new NotFoundException('Tienda no encontrada');
    const primary = await this.db
      .selectFrom('platform.storeDomains')
      .select('domain')
      .where('storeId', '=', row.id)
      .where('isPrimary', '=', true)
      .where('verified', '=', true)
      .executeTakeFirst();
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      primaryDomain:
        primary?.domain ?? `${row.slug}.${this.config.platformDomain}`,
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
      platformDomain: `${row.slug}.${this.config.platformDomain}`,
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

function toDomainDto(row: DomainRow, secret: string): StoreDomainDto {
  return {
    ...row,
    verificationName: verificationRecordName(row.domain),
    verificationValue: verificationToken(secret, row.id),
    createdAt: row.createdAt.toISOString(),
  };
}
