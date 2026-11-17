import { Controller, Get, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import type { MeDto } from '@o-stores/contracts';
import { AuthGuard } from './auth.guard';
import type { AuthUser } from './auth.types';
import { CurrentUser } from './decorators';
import { MembershipLookup } from './membership-lookup';
import { RolesGuard } from './roles.guard';
import { TokenVerifier } from './token-verifier';

@Controller('me')
export class MeController {
  constructor(private readonly lookup: MembershipLookup) {}

  /** Quién soy y qué puedo gestionar; el admin lo usa tras iniciar sesión. */
  @Get()
  async me(@CurrentUser() user: AuthUser): Promise<MeDto> {
    const access = await this.lookup.accessFor(user.id);
    return { ...user, ...access };
  }
}

@Module({
  controllers: [MeController],
  providers: [
    TokenVerifier,
    MembershipLookup,
    // El orden importa: primero la sesión, después los roles.
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [MembershipLookup],
})
export class AuthModule {}
