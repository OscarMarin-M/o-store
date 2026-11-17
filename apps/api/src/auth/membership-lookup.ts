import { Injectable } from '@nestjs/common';
import type { MembershipDto } from '@o-stores/contracts';
import { DatabaseService } from '../database/database.service';
import type { Access } from './auth.types';

@Injectable()
export class MembershipLookup {
  constructor(private readonly database: DatabaseService) {}

  forUser(userId: string): Promise<MembershipDto[]> {
    return this.database.db
      .selectFrom('platform.memberships')
      .select(['storeId', 'role'])
      .where('userId', '=', userId)
      .execute();
  }

  async accessFor(userId: string): Promise<Access> {
    const memberships = await this.forUser(userId);
    return {
      memberships,
      isSuperAdmin: memberships.some((m) => m.role === 'super_admin'),
    };
  }
}
