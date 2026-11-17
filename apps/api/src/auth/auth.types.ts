import type { MembershipDto } from '@o-stores/contracts';

export interface AuthUser {
  id: string;
  email: string | null;
}

/** Permisos del usuario, cargados por RolesGuard en rutas con @Roles. */
export interface Access {
  isSuperAdmin: boolean;
  memberships: MembershipDto[];
}

/** Lo que los guards añaden a la petición de Express. */
export interface AuthedRequest {
  headers: Record<string, string | string[] | undefined>;
  params: Record<string, string | undefined>;
  user?: AuthUser;
  access?: Access;
}
