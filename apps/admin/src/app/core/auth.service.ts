import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import type { ClientConfigDto, MeDto, Role } from '@o-stores/contracts';
import {
  createClient,
  type Session,
  type SupabaseClient,
} from '@supabase/supabase-js';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

/**
 * Sesión con Supabase Auth y datos del usuario (GET /api/me).
 * Supabase solo se usa para la sesión; los datos siempre pasan por la API.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private client: SupabaseClient | null = null;
  private refreshing: Promise<string | null> | null = null;

  readonly session = signal<Session | null>(null);
  readonly me = signal<MeDto | null>(null);
  /** true si la API no respondió al arrancar. */
  readonly unavailable = signal(false);
  /** true si se cerró la sesión porque venció; la página de entrar lo avisa. */
  readonly expired = signal(false);
  readonly isSuperAdmin = computed(() => this.me()?.isSuperAdmin ?? false);

  /**
   * Se ejecuta al arrancar la app (provideAppInitializer) y en cada reintento del
   * login mientras la API no responda. Se puede repetir: lo ya conseguido (cliente
   * de Supabase) no se rehace, y lo que falló se vuelve a intentar.
   */
  async init(): Promise<void> {
    try {
      if (!this.client) {
        const config = await firstValueFrom(
          this.http.get<ClientConfigDto>('/api/public/config'),
        );
        this.client = createClient(
          config.supabaseUrl,
          config.supabasePublishableKey,
        );
        this.client.auth.onAuthStateChange((_event, session) => {
          this.session.set(session);
          if (!session) this.me.set(null);
        });
      }
      const { data } = await this.client.auth.getSession();
      this.session.set(data.session);
      if (data.session && !this.me()) await this.loadMe();
      this.unavailable.set(false);
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        // La sesión guardada ya no vale: se entra de nuevo, no es que falte la API.
        await this.client?.auth.signOut({ scope: 'local' });
        this.session.set(null);
        this.unavailable.set(false);
      } else {
        this.unavailable.set(true);
      }
    }
  }

  token(): string | null {
    return this.session()?.access_token ?? null;
  }

  /** Devuelve un mensaje de error para mostrar, o null si entró. */
  async signIn(email: string, password: string): Promise<string | null> {
    if (!this.client) return 'La API todavía no responde. Espera unos segundos e inténtalo de nuevo.';
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
    this.expired.set(false);
    return null;
  }

  /**
   * Pide a Supabase un token nuevo. Si varias peticiones reciben 401 a la vez,
   * comparten la misma renovación. Devuelve el token o null si no se pudo.
   */
  refresh(): Promise<string | null> {
    if (!this.client) return Promise.resolve(null);
    this.refreshing ??= this.client.auth
      .refreshSession()
      .then(({ data, error }) => {
        if (error || !data.session) return null;
        this.session.set(data.session);
        return data.session.access_token;
      })
      .catch(() => null)
      .finally(() => (this.refreshing = null));
    return this.refreshing;
  }

  /** La sesión venció en medio del trabajo: la cierra y lleva a entrar, recordando dónde estaba. */
  expire(): void {
    // Sin `me` no se había entrado (o ya se está saliendo): nada que redirigir.
    if (!this.me()) return;
    const volver = this.router.url;
    this.me.set(null);
    this.session.set(null);
    this.expired.set(true);
    void this.client?.auth.signOut({ scope: 'local' });
    void this.router.navigate(['/entrar'], { queryParams: { volver } });
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
