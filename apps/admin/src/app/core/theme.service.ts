import { Injectable, signal } from '@angular/core';

export type ThemeMode = 'dark' | 'light';

/** Tema oscuro por defecto; el claro se guarda en este navegador. */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly mode = signal<ThemeMode>(
    document.documentElement.dataset['theme'] === 'light' ? 'light' : 'dark',
  );

  toggle(): void {
    const next: ThemeMode = this.mode() === 'dark' ? 'light' : 'dark';
    this.mode.set(next);
    if (next === 'light') document.documentElement.dataset['theme'] = 'light';
    else delete document.documentElement.dataset['theme'];
    try {
      localStorage.setItem('os-theme', next);
    } catch {
      // Sin almacenamiento el tema dura solo esta visita.
    }
  }
}
