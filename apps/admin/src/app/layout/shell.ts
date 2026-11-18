import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { MatIcon } from '@angular/material/icon';
import { filter } from 'rxjs';
import { AuthService } from '../core/auth.service';
import { StoresService } from '../core/stores.service';
import { ThemeService } from '../core/theme.service';
import { STORE_SECTIONS } from '../store/store-sections';

/** Marco del admin: menú lateral con las tiendas y franja con el color de la activa. */
@Component({
  selector: 'os-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  protected readonly auth = inject(AuthService);
  protected readonly stores = inject(StoresService);
  protected readonly theme = inject(ThemeService);
  private readonly router = inject(Router);

  protected readonly menuOpen = signal(false);

  /** Secciones de la tienda activa que el rol del usuario puede ver. */
  protected readonly sections = computed(() => {
    const store = this.stores.active();
    if (!store) return [];
    const role = this.auth.roleIn(store.id);
    return STORE_SECTIONS.filter(
      (s) => role === 'super_admin' || (role !== null && s.roles.includes(role)),
    );
  });

  constructor() {
    void this.stores.load();
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.menuOpen.set(false));
  }

  protected async signOut(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigateByUrl('/entrar');
  }
}
