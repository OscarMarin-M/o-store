import { Injectable } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { AppConfig } from '../config/app-config';
import type { AuthUser } from './auth.types';

/**
 * Comprueba la firma y vigencia del JWT de Supabase Auth sin llamar a Supabase
 * en cada petición: las claves públicas (JWKS) se descargan una vez y se cachean.
 */
@Injectable()
export class TokenVerifier {
  private readonly issuer: string;
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;
  private readonly secret: Uint8Array | null;

  constructor(config: AppConfig) {
    this.issuer = `${config.supabaseUrl}/auth/v1`;
    this.jwks = createRemoteJWKSet(
      new URL(`${this.issuer}/.well-known/jwks.json`),
    );
    this.secret = config.supabaseJwtSecret
      ? new TextEncoder().encode(config.supabaseJwtSecret)
      : null;
  }

  /** Lanza si el token no es válido. */
  async verify(token: string): Promise<AuthUser> {
    const options = { issuer: this.issuer, audience: 'authenticated' };
    let payload: JWTPayload;
    if (this.secret) {
      ({ payload } = await jwtVerify(token, this.secret, {
        ...options,
        algorithms: ['HS256'],
      }));
    } else {
      ({ payload } = await jwtVerify(token, this.jwks, options));
    }
    if (!payload.sub) throw new Error('Token sin usuario');
    const email = payload['email'];
    return { id: payload.sub, email: typeof email === 'string' ? email : null };
  }
}
