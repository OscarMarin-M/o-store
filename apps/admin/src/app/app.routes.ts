import type { Route } from '@angular/router';
import {
  authGuard,
  guestGuard,
  homeRedirectGuard,
  storeRoleGuard,
  superAdminGuard,
} from './core/guards';
import { STORE_SECTIONS } from './store/store-sections';

type Loader = NonNullable<Route['loadComponent']>;

const pendingSection: Loader = () =>
  import('./store/pending-section').then((m) => m.PendingSection);

/** Secciones de tienda ya construidas; las demás muestran el aviso de pendiente. */
const SECTION_PAGES: Record<string, Loader> = {
  apariencia: () =>
    import('./store/appearance/appearance-page').then((m) => m.AppearancePage),
};

export const appRoutes: Route[] = [
  {
    path: 'entrar',
    canActivate: [guestGuard],
    title: 'Entrar a O-stores',
    loadComponent: () => import('./auth/login-page').then((m) => m.LoginPage),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell').then((m) => m.Shell),
    children: [
      {
        path: '',
        pathMatch: 'full',
        canActivate: [homeRedirectGuard],
        title: 'Sin tiendas',
        loadComponent: () => import('./layout/no-stores').then((m) => m.NoStores),
      },
      {
        path: 'plataforma/tiendas',
        canActivate: [superAdminGuard],
        title: 'Tiendas de la plataforma',
        loadComponent: () =>
          import('./platform/platform-stores').then((m) => m.PlatformStores),
      },
      {
        path: 'tienda/:storeId',
        loadComponent: () =>
          import('./store/store-layout').then((m) => m.StoreLayout),
        children: [
          { path: '', pathMatch: 'full', redirectTo: STORE_SECTIONS[0].path },
          ...STORE_SECTIONS.map(
            (section): Route => ({
              path: section.path,
              title: section.label,
              canActivate: [storeRoleGuard(section.roles)],
              data: { title: section.label },
              loadComponent: SECTION_PAGES[section.path] ?? pendingSection,
            }),
          ),
        ],
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
