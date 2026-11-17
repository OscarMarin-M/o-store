import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import type { ClientConfigDto, MeDto, Role } from '@o-stores/contracts';
import {
  createClient,
  type Session,
  type SupabaseClient,
} from '@supabase/supabase-js';
import { firstValueFrom } from 'rxjs';

/**
 * Sesión con Supabase Auth y datos del usuario (GET /api/me).
 * Supabase solo se usa para la sesión; los datos siempre pasan por la API.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private client: SupabaseClient | null = null;

  readonly session = signal<Session | null>(null);
  readonly me = signal<MeDto | null>(null);
  /** true si la API no respondió al arrancar. */
  readonly unavailable = signal(false);
  readonly isSuperAdmin = computed(() => this.me()?.isSuperAdmin ?? false);

  /** Se ejecuta una vez al arrancar la app (provideAppInitializer). */
  async init(): Promise<void> {
    try {
      const config = await firstValueFrom(
        this.http.get<ClientConfigDto>('/api/public/config'),
      );
      this.client = createClient(
        config.supabaseUrl,
        config.supabasePublishableKey,
      );
      const { data } = await this.client.auth.getSession();
      this.session.set(data.session);
      this.client.auth.onAuthStateChange((_event, session) => {
        this.session.set(session);
        if (!session) this.me.set(null);
      });
      if (data.session) await this.loadMe();
    } catch {
      this.unavailable.set(true);
    }
  }

  token(): string | null {
    return this.session()?.access_token ?? null;
  }

  /** Devuelve un mensaje de error para mostrar, o null si entró. */
  async signIn(email: string, password: string): Promise<string | null> {
    if (!this.client) return 'No hay conexión con el servidor. Revisa que la API esté encendida.';
    const { data, error } = await this.client.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      return error.code === 'invalid_credentials'
        ? 'El correo o la contraseña no coinciden.'
        : 'No se pudo iniciar sesión. Inténtalo de nuevo en un momento.';
    }
    this.session.set(data.session);
    await this.loadMe();
    return null;
  }

  async signOut(): Promise<void> {
    await this.client?.auth.signOut();
    this.session.set(null);
    this.me.set(null);
  }

  /** Rol del usuario en una tienda; super_admin cuenta en todas. */
  roleIn(storeId: string): Role | null {
    const me = this.me();
    if (!me) return null;
    if (me.isSuperAdmin) return 'super_admin';
    return me.memberships.find((m) => m.storeId === storeId)?.role ?? null;
  }

  private async loadMe(): Promise<void> {
    this.me.set(await firstValueFrom(this.http.get<MeDto>('/api/me')));
  }
}
