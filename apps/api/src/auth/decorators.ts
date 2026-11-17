import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import type { Role } from '@o-stores/contracts';
import type { AuthedRequest } from './auth.types';

export const IS_PUBLIC = 'isPublic';
export const ROLES = 'roles';

/** Ruta sin sesión. Sin este decorador toda ruta exige un JWT válido. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/**
 * Roles que pueden usar la ruta. Un super_admin pasa siempre; los roles de
 * tienda se comprueban contra el parámetro :storeId de la ruta.
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<AuthedRequest>().user,
);

/** Solo disponible en rutas con @Roles. */
export const IsSuperAdmin = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<AuthedRequest>().access?.isSuperAdmin ??
    false,
);
