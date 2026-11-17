import {
  ForbiddenException,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { MembershipDto, Role } from '@o-stores/contracts';
import { describe, expect, it } from 'vitest';
import { AuthGuard } from './auth.guard';
import type { AuthedRequest } from './auth.types';
import { IS_PUBLIC, ROLES } from './decorators';
import type { MembershipLookup } from './membership-lookup';
import { RolesGuard } from './roles.guard';
import type { TokenVerifier } from './token-verifier';

const STORE_A = '11111111-1111-4111-8111-111111111111';
const STORE_B = '22222222-2222-4222-8222-222222222222';

function reflector(metadata: Record<string, unknown>): Reflector {
  return {
    getAllAndOverride: (key: string) => metadata[key],
  } as unknown as Reflector;
}

function contextFor(request: AuthedRequest): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function request(partial: Partial<AuthedRequest> = {}): AuthedRequest {
  return { headers: {}, params: {}, ...partial };
}

describe('AuthGuard', () => {
  const verifier = {
    verify: async (token: string) => {
      if (token !== 'valido') throw new Error('firma incorrecta');
      return { id: 'user-1', email: 'a@b.c' };
    },
  } as TokenVerifier;

  it('deja pasar rutas públicas sin token', async () => {
    const guard = new AuthGuard(reflector({ [IS_PUBLIC]: true }), verifier);
    await expect(guard.canActivate(contextFor(request()))).resolves.toBe(true);
  });

  it('rechaza con 401 si falta el token', async () => {
    const guard = new AuthGuard(reflector({}), verifier);
    await expect(guard.canActivate(contextFor(request()))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rechaza con 401 si el token no es válido', async () => {
    const guard = new AuthGuard(reflector({}), verifier);
    const req = request({ headers: { authorization: 'Bearer falso' } });
    await expect(guard.canActivate(contextFor(req))).rejects.toThrow(
      UnauthorizedException,
    );
    expect(req.user).toBeUndefined();
  });

  it('con token válido deja al usuario en la petición', async () => {
    const guard = new AuthGuard(reflector({}), verifier);
    const req = request({ headers: { authorization: 'Bearer valido' } });
    await expect(guard.canActivate(contextFor(req))).resolves.toBe(true);
    expect(req.user).toEqual({ id: 'user-1', email: 'a@b.c' });
  });
});

describe('RolesGuard', () => {
  function guardFor(required: Role[] | undefined, memberships: MembershipDto[]) {
    const lookup = {
      accessFor: async () => ({
        memberships,
        isSuperAdmin: memberships.some((m) => m.role === 'super_admin'),
      }),
    } as unknown as MembershipLookup;
    return new RolesGuard(reflector({ [ROLES]: required }), lookup);
  }

  const user = { id: 'user-1', email: null };

  it('sin @Roles no restringe', async () => {
    const guard = guardFor(undefined, []);
    await expect(
      guard.canActivate(contextFor(request({ user }))),
    ).resolves.toBe(true);
  });

  it('un super_admin pasa en cualquier tienda', async () => {
    const guard = guardFor(
      ['store_owner'],
      [{ storeId: null, role: 'super_admin' }],
    );
    const req = request({ user, params: { storeId: STORE_B } });
    await expect(guard.canActivate(contextFor(req))).resolves.toBe(true);
    expect(req.access?.isSuperAdmin).toBe(true);
  });

  it('un store_staff entra a su tienda', async () => {
    const guard = guardFor(
      ['store_owner', 'store_staff'],
      [{ storeId: STORE_A, role: 'store_staff' }],
    );
    const req = request({ user, params: { storeId: STORE_A } });
    await expect(guard.canActivate(contextFor(req))).resolves.toBe(true);
  });

  it('un store_staff recibe 403 en otra tienda', async () => {
    const guard = guardFor(
      ['store_owner', 'store_staff'],
      [{ storeId: STORE_A, role: 'store_staff' }],
    );
    const req = request({ user, params: { storeId: STORE_B } });
    await expect(guard.canActivate(contextFor(req))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('un store_staff recibe 403 en acciones de store_owner', async () => {
    const guard = guardFor(
      ['store_owner'],
      [{ storeId: STORE_A, role: 'store_staff' }],
    );
    const req = request({ user, params: { storeId: STORE_A } });
    await expect(guard.canActivate(contextFor(req))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('un store_owner recibe 403 en rutas solo de super_admin', async () => {
    const guard = guardFor(
      ['super_admin'],
      [{ storeId: STORE_A, role: 'store_owner' }],
    );
    const req = request({ user, params: { storeId: STORE_A } });
    await expect(guard.canActivate(contextFor(req))).rejects.toThrow(
      ForbiddenException,
    );
  });
});
