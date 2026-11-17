import {
  BadGatewayException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Injectable,
  Module,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  addMemberSchema,
  updateMemberSchema,
  type AddMemberInput,
  type MemberDto,
  type StoreRole,
  type UpdateMemberInput,
} from '@o-stores/contracts';
import { sql } from 'kysely';
import { Roles } from '../auth/decorators';
import { isUniqueViolation } from '../common/pg-errors';
import { ZodBody } from '../common/zod-body.pipe';
import {
  SUPABASE_ADMIN,
  type SupabaseAdmin,
} from '../database/database.module';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class MembershipsService {
  constructor(
    private readonly database: DatabaseService,
    @Inject(SUPABASE_ADMIN) private readonly supabase: SupabaseAdmin,
  ) {}

  private get db() {
    return this.database.db;
  }

  async list(storeId: string): Promise<MemberDto[]> {
    const rows = await this.db
      .selectFrom('platform.memberships as m')
      .leftJoin('auth.users as u', 'u.id', 'm.userId')
      .select(['m.id', 'm.userId', 'u.email', 'm.role', 'm.createdAt'])
      .where('m.storeId', '=', storeId)
      .orderBy('m.createdAt')
      .execute();
    return rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      email: row.email,
      role: row.role as StoreRole,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  /** Si el correo aún no tiene cuenta, Supabase le envía una invitación. */
  async add(storeId: string, input: AddMemberInput): Promise<MemberDto> {
    const store = await this.db
      .selectFrom('platform.stores')
      .select('id')
      .where('id', '=', storeId)
      .executeTakeFirst();
    if (!store) throw new NotFoundException('Tienda no encontrada');

    const userId =
      (await this.findUserId(input.email)) ?? (await this.invite(input.email));
    try {
      const row = await this.db
        .insertInto('platform.memberships')
        .values({ userId, storeId, role: input.role })
        .returning(['id', 'createdAt'])
        .executeTakeFirstOrThrow();
      return {
        id: row.id,
        userId,
        email: input.email,
        role: input.role,
        createdAt: row.createdAt.toISOString(),
      };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Ese usuario ya pertenece a la tienda');
      }
      throw error;
    }
  }

  async updateRole(
    storeId: string,
    membershipId: string,
    role: StoreRole,
  ): Promise<void> {
    const result = await this.db
      .updateTable('platform.memberships')
      .set({ role })
      .where('id', '=', membershipId)
      .where('storeId', '=', storeId)
      .executeTakeFirst();
    if (result.numUpdatedRows === 0n) {
      throw new NotFoundException('Membresía no encontrada');
    }
  }

  async remove(storeId: string, membershipId: string): Promise<void> {
    const result = await this.db
      .deleteFrom('platform.memberships')
      .where('id', '=', membershipId)
      .where('storeId', '=', storeId)
      .executeTakeFirst();
    if (result.numDeletedRows === 0n) {
      throw new NotFoundException('Membresía no encontrada');
    }
  }

  /** Da el rol de plataforma a una cuenta que ya existe en Supabase Auth. */
  async grantSuperAdmin(email: string): Promise<void> {
    const userId = await this.findUserId(email.trim().toLowerCase());
    if (!userId) {
      throw new Error(
        `No hay ninguna cuenta con el correo ${email}. Créala primero en Supabase: Authentication > Users > Add user.`,
      );
    }
    await this.db
      .insertInto('platform.memberships')
      .values({ userId, storeId: null, role: 'super_admin' })
      .onConflict((conflict) => conflict.doNothing())
      .execute();
  }

  private async findUserId(email: string): Promise<string | null> {
    const row = await this.db
      .selectFrom('auth.users')
      .select('id')
      .where(sql<string>`lower(email)`, '=', email)
      .executeTakeFirst();
    return row?.id ?? null;
  }

  private async invite(email: string): Promise<string> {
    const { data, error } =
      await this.supabase.auth.admin.inviteUserByEmail(email);
    if (error || !data.user) {
      throw new BadGatewayException(
        `No se pudo invitar a ${email}: ${error?.message ?? 'sin respuesta'}`,
      );
    }
    return data.user.id;
  }
}

@Controller('stores/:storeId/members')
@Roles('store_owner')
export class MembershipsController {
  constructor(private readonly memberships: MembershipsService) {}

  @Get()
  list(@Param('storeId', ParseUUIDPipe) storeId: string) {
    return this.memberships.list(storeId);
  }

  @Post()
  add(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body(new ZodBody(addMemberSchema)) body: AddMemberInput,
  ) {
    return this.memberships.add(storeId, body);
  }

  @Patch(':membershipId')
  @HttpCode(204)
  updateRole(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('membershipId', ParseUUIDPipe) membershipId: string,
    @Body(new ZodBody(updateMemberSchema)) body: UpdateMemberInput,
  ) {
    return this.memberships.updateRole(storeId, membershipId, body.role);
  }

  @Delete(':membershipId')
  @HttpCode(204)
  remove(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('membershipId', ParseUUIDPipe) membershipId: string,
  ) {
    return this.memberships.remove(storeId, membershipId);
  }
}

@Module({
  controllers: [MembershipsController],
  providers: [MembershipsService],
  exports: [MembershipsService],
})
export class MembershipsModule {}
