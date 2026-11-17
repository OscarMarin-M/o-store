import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@o-stores/contracts';
import type { AuthedRequest } from './auth.types';
import { ROLES } from './decorators';
import { MembershipLookup } from './membership-lookup';

/**
 * Aplica @Roles. Un super_admin pasa siempre; cualquier otro necesita una
 * membresía con uno de los roles pedidos en la tienda del parámetro :storeId.
 * Corre después de AuthGuard, que deja el usuario en la petición.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly lookup: MembershipLookup,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<AuthedRequest>();
    if (!request.user) throw new ForbiddenException();

    const access = await this.lookup.accessFor(request.user.id);
    request.access = access;
    if (access.isSuperAdmin) return true;

    const storeId = request.params['storeId'];
    const allowed =
      !!storeId &&
      access.memberships.some(
        (m) => m.storeId === storeId && required.includes(m.role),
      );
    if (!allowed) {
      throw new ForbiddenException('No tienes permiso sobre esta tienda');
    }
    return true;
  }
}
