import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Router } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'os-login-page',
  imports: [FormsModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="login">
      <form class="os-panel form" (ngSubmit)="submit()">
        <h1>Entrar a O-stores</h1>

        @if (auth.unavailable()) {
          <p class="os-error" role="alert">
            No hay conexión con el servidor. Enciende la API con <span class="os-mono">npx nx serve api</span> y recarga la página.
          </p>
        }

        <mat-form-field appearance="outline">
          <mat-label>Correo</mat-label>
          <input matInput type="email" name="email" autocomplete="email" required [(ngModel)]="email" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Contraseña</mat-label>
          <input matInput type="password" name="password" autocomplete="current-password" required [(ngModel)]="password" />
        </mat-form-field>

        @if (error(); as message) {
          <p class="os-error" role="alert">{{ message }}</p>
        }

        <button mat-flat-button class="os-primary" type="submit" [disabled]="busy()">
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
      gap: var(--os-space-2);
      width: min(100%, 360px);
      padding: var(--os-space-5);
      border-top: 4px solid var(--os-color-accent);
    }
    h1 {
      font-size: var(--os-text-xl);
      margin-bottom: var(--os-space-3);
    }
    p {
      margin: 0 0 var(--os-space-2);
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
