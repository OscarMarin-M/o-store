import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthedRequest } from './auth.types';
import { IS_PUBLIC } from './decorators';
import { TokenVerifier } from './token-verifier';

/** Exige un JWT de Supabase válido en toda ruta que no sea @Public. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly verifier: TokenVerifier,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const header = request.headers['authorization'];
    const match =
      typeof header === 'string' ? /^Bearer\s+(\S+)$/i.exec(header) : null;
    if (!match) throw new UnauthorizedException('Falta el token de sesión');

    try {
      request.user = await this.verifier.verify(match[1]);
    } catch {
      throw new UnauthorizedException('Token de sesión inválido o vencido');
    }
    return true;
  }
}
