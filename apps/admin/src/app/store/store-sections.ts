import type { Role } from '@o-stores/contracts';

export interface StoreSection {
  path: string;
  label: string;
  /** Roles de tienda que la ven; super_admin ve todas. */
  roles: Role[];
}

const everyone: Role[] = ['store_owner', 'store_staff'];
const ownerOnly: Role[] = ['store_owner'];

/** Menú y rutas de una tienda salen de esta lista. */
export const STORE_SECTIONS: StoreSection[] = [
  { path: 'productos', label: 'Productos', roles: everyone },
  { path: 'pedidos', label: 'Pedidos', roles: everyone },
  { path: 'entregas', label: 'Entregas', roles: everyone },
  { path: 'clientes', label: 'Clientes', roles: ownerOnly },
  { path: 'equipo', label: 'Equipo', roles: ownerOnly },
  { path: 'apariencia', label: 'Logo y colores', roles: ownerOnly },
  { path: 'dominios', label: 'Dominios', roles: ownerOnly },
];
