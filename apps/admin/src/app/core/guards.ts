import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import type { Role } from '@o-stores/contracts';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.me() ? true : inject(Router).createUrlTree(['/entrar']);
};

export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.me() ? inject(Router).createUrlTree(['/']) : true;
};

export const superAdminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isSuperAdmin() ? true : inject(Router).createUrlTree(['/']);
};

/** Lleva al inicio que corresponde al rol: plataforma o la primera tienda. */
export const homeRedirectGuard: CanActivateFn = () => {
  const me = inject(AuthService).me();
  const router = inject(Router);
  if (me?.isSuperAdmin) return router.createUrlTree(['/plataforma/tiendas']);
  const storeId = me?.memberships.find((m) => m.storeId)?.storeId;
  return storeId ? router.createUrlTree(['/tienda', storeId]) : true;
};

/** Limita una sección de tienda a ciertos roles (super_admin siempre pasa). */
export function storeRoleGuard(roles: Role[]): CanActivateFn {
  return (route) => {
    const auth = inject(AuthService);
    const storeId = route.parent?.paramMap.get('storeId') ?? '';
    const role = auth.roleIn(storeId);
    if (role === 'super_admin' || (role && roles.includes(role))) return true;
    return inject(Router).createUrlTree(['/tienda', storeId]);
  };
}
