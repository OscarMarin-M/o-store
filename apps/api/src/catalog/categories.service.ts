import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { slugify, type CategoryDto, type CategoryInput, fieldError } from '@o-stores/contracts';
import { sql, type QueryCreator } from 'kysely';
import { isUniqueViolation } from '../common/pg-errors';
import type { TenantDB } from '../database/types';
import { TenantDbService } from './tenant-db.service';

type Db = QueryCreator<TenantDB>;

const toDto = (r: Omit<CategoryDto, 'productCount'> & { productCount: string | null }): CategoryDto => ({
  ...r,
  productCount: Number(r.productCount ?? 0),
});

@Injectable()
export class CategoriesService {
  constructor(private readonly tenants: TenantDbService) {}

  /** Todas, en orden; el admin arma el árbol con parentId. */
  async list(storeId: string): Promise<CategoryDto[]> {
    const { db } = await this.tenants.forStore(storeId);
    const rows = await this.query(db).orderBy('c.position').orderBy('c.name').execute();
    return rows.map(toDto);
  }

  async create(storeId: string, input: CategoryInput): Promise<CategoryDto> {
    const { db } = await this.tenants.forStore(storeId);
    if (input.parentId) await this.checkParent(db, input.parentId, null);
    const slug = input.slug ?? (await this.freeSlug(db, input.name));
    const id = await this.translate(input, async () => {
      const row = await db
        .insertInto('categories')
        .values({
          name: input.name,
          slug,
          parentId: input.parentId,
          position: await this.nextPosition(db, input.parentId),
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      return row.id;
    });
    return this.get(db, id);
  }

  async update(storeId: string, categoryId: string, input: CategoryInput): Promise<CategoryDto> {
    const { db } = await this.tenants.forStore(storeId);
    const current = await this.find(db, categoryId);
    if (input.parentId) await this.checkParent(db, input.parentId, categoryId);
    // Al cambiar de nivel pasa al final de sus nuevas hermanas.
    const position =
      input.parentId !== current.parentId ? await this.nextPosition(db, input.parentId) : undefined;
    await this.translate(input, () =>
      db
        .updateTable('categories')
        .set({
          name: input.name,
          // Renombrar no cambia la dirección: los enlaces ya compartidos siguen sirviendo.
          slug: input.slug ?? current.slug,
          parentId: input.parentId,
          ...(position === undefined ? {} : { position }),
        })
        .where('id', '=', categoryId)
        .execute(),
    );
    return this.get(db, categoryId);
  }

  /** Sus productos quedan sin categoría (la clave foránea pone null). */
  async remove(storeId: string, categoryId: string): Promise<void> {
    const { db } = await this.tenants.forStore(storeId);
    await this.find(db, categoryId);
    if (await this.hasChildren(db, categoryId)) {
      throw new ConflictException('Tiene subcategorías: muévelas o bórralas primero');
    }
    await db.deleteFrom('categories').where('id', '=', categoryId).execute();
  }

  /** `ids` debe traer exactamente las hermanas de un mismo padre, en el orden nuevo. */
  async reorder(storeId: string, ids: string[]): Promise<CategoryDto[]> {
    const tenant = await this.tenants.forStore(storeId);
    const { db } = tenant;
    const first = await this.find(db, ids[0]);
    const siblings = await db
      .selectFrom('categories')
      .select('id')
      .where((eb) =>
        first.parentId ? eb('parentId', '=', first.parentId) : eb('parentId', 'is', null),
      )
      .execute();
    const expected = new Set(siblings.map((s) => s.id));
    if (new Set(ids).size !== ids.length || ids.length !== expected.size || ids.some((id) => !expected.has(id))) {
      throw new BadRequestException('El orden debe incluir todas las categorías del mismo nivel');
    }
    await tenant.conn.transaction().execute(async (trx) => {
      for (const [position, id] of ids.entries()) {
        await trx
          .withSchema(tenant.schema)
          .updateTable('categories')
          .set({ position })
          .where('id', '=', id)
          .execute();
      }
    });
    return this.list(storeId);
  }

  // ---- Interno ----

  private async find(db: Db, id: string) {
    const row = await db
      .selectFrom('categories')
      .select(['id', 'slug', 'parentId'])
      .where('id', '=', id)
      .executeTakeFirst();
    if (!row) throw new NotFoundException('Categoría no encontrada');
    return row;
  }

  private async get(db: Db, id: string): Promise<CategoryDto> {
    return toDto(await this.query(db).where('c.id', '=', id).executeTakeFirstOrThrow());
  }

  private query(db: Db) {
    return db
      .selectFrom('categories as c')
      .select(['c.id', 'c.name', 'c.slug', 'c.parentId', 'c.position'])
      .select((eb) =>
        eb
          .selectFrom('products as p')
          .whereRef('p.categoryId', '=', 'c.id')
          .where('p.status', '!=', 'archived')
          .select(eb.fn.countAll<string>().as('n'))
          .as('productCount'),
      );
  }

  /** Solo dos niveles: el padre debe ser de primer nivel y `self` no puede tener hijas. */
  private async checkParent(db: Db, parentId: string, self: string | null): Promise<void> {
    if (parentId === self) throw new BadRequestException(fieldError('parentId', 'Una categoría no puede estar dentro de sí misma'));
    const parent = await db
      .selectFrom('categories')
      .select('parentId')
      .where('id', '=', parentId)
      .executeTakeFirst();
    if (!parent) throw new BadRequestException(fieldError('parentId', 'La categoría superior ya no existe'));
    if (parent.parentId) {
      throw new BadRequestException(fieldError('parentId', 'Solo hay dos niveles: elige una categoría principal como superior'));
    }
    if (self && (await this.hasChildren(db, self))) {
      throw new BadRequestException(fieldError('parentId', 'Tiene subcategorías, así que no puede ser subcategoría de otra'));
    }
  }

  private async hasChildren(db: Db, id: string): Promise<boolean> {
    const child = await db
      .selectFrom('categories')
      .select('id')
      .where('parentId', '=', id)
      .executeTakeFirst();
    return !!child;
  }

  private maxPosition(db: Db, parentId: string | null) {
    return db
      .selectFrom('categories')
      .select(sql<number>`coalesce(max(position), -1)`.as('m'))
      .where((eb) => (parentId ? eb('parentId', '=', parentId) : eb('parentId', 'is', null)));
  }

  private async nextPosition(db: Db, parentId: string | null): Promise<number> {
    const { m } = await this.maxPosition(db, parentId).executeTakeFirstOrThrow();
    return Number(m) + 1;
  }

  /** Dirección libre a partir del nombre: sobres, sobres-2, sobres-3… */
  private async freeSlug(db: Db, name: string): Promise<string> {
    const base = slugify(name, 70) || 'categoria';
    const taken = await db
      .selectFrom('categories')
      .select('slug')
      .where((eb) => eb.or([eb('slug', '=', base), eb('slug', 'like', `${base}-%`)]))
      .execute();
    const used = new Set(taken.map((t) => t.slug));
    if (!used.has(base)) return base;
    let n = 2;
    while (used.has(`${base}-${n}`)) n++;
    return `${base}-${n}`;
  }

  private async translate<T>(input: CategoryInput, work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(fieldError('slug', `La dirección ${input.slug ?? ''} ya la usa otra categoría; elige otra`));
      }
      throw error;
    }
  }
}
