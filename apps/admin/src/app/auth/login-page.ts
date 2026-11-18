import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { Router } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { OS_UI } from '../ui/ui';

@Component({
  selector: 'os-login-page',
  imports: [FormsModule, MatButtonModule, OS_UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="login">
      <form class="os-panel form" (ngSubmit)="submit()">
        <h1>Entrar a O-stores</h1>

        @if (auth.unavailable()) {
          <os-notice kind="error">
            No hay conexión con el servidor. Revisa que la API esté encendida (<span class="os-mono">npx nx serve api</span>).
          </os-notice>
          <button mat-button type="button" [disabled]="retrying()" (click)="retry()">
            <mat-icon>refresh</mat-icon>
            {{ retrying() ? 'Conectando…' : 'Reintentar' }}
          </button>
        }

        <os-field label="Correo" icon="mail">
          <input osControl type="email" name="email" autocomplete="email" required [(ngModel)]="email" />
        </os-field>

        <os-field label="Contraseña" icon="lock" [error]="error()">
          <input osControl type="password" name="password" autocomplete="current-password" required [(ngModel)]="password" />
        </os-field>

        <button mat-flat-button class="os-primary submit" type="submit" [disabled]="busy()">
          <mat-icon>login</mat-icon>
          {{ busy() ? 'Entrando…' : 'Entrar' }}
        </button>
      </form>
    </main>
  `,
  styles: `
    .login {
      display: grid;
      place-items: center;
      min-height: 100dvh;
      padding: var(--os-space-4);
    }
    .form {
      display: flex;
      flex-direction: column;
      gap: var(--os-space-4);
      width: min(100%, 360px);
      padding: var(--os-space-5);
      border-top: 4px solid var(--os-color-accent);
    }
    h1 {
      font-size: var(--os-text-xl);
    }
    p {
      margin: 0;
    }
    .submit {
      margin-top: var(--os-space-1);
    }
  `,
})
export class LoginPage {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected email = '';
  protected password = '';
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly retrying = signal(false);

  protected async retry(): Promise<void> {
    this.retrying.set(true);
    await this.auth.init();
    this.retrying.set(false);
    // Si había una sesión guardada, ya se puede entrar directamente.
    if (this.auth.me()) await this.router.navigateByUrl('/');
  }

  protected async submit(): Promise<void> {
    if (!this.email || !this.password) {
      this.error.set('Escribe tu correo y tu contraseña.');
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    const message = await this.auth.signIn(this.email.trim(), this.password);
    this.busy.set(false);
    if (message) this.error.set(message);
    else await this.router.navigateByUrl('/');
  }
}
