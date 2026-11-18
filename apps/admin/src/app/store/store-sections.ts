import type { Role } from '@o-stores/contracts';

export interface StoreSection {
  path: string;
  label: string;
  /** Nombre de Material Symbols para el menú. */
  icon: string;
  /** Roles de tienda que la ven; super_admin ve todas. */
  roles: Role[];
}

const everyone: Role[] = ['store_owner', 'store_staff'];
const ownerOnly: Role[] = ['store_owner'];

/** Menú y rutas de una tienda salen de esta lista. */
export const STORE_SECTIONS: StoreSection[] = [
  { path: 'productos', label: 'Productos', icon: 'inventory_2', roles: everyone },
  { path: 'categorias', label: 'Categorías', icon: 'category', roles: everyone },
  { path: 'pedidos', label: 'Pedidos', icon: 'receipt_long', roles: everyone },
  { path: 'entregas', label: 'Entregas', icon: 'local_shipping', roles: everyone },
  { path: 'clientes', label: 'Clientes', icon: 'group', roles: ownerOnly },
  { path: 'equipo', label: 'Equipo', icon: 'badge', roles: ownerOnly },
  { path: 'apariencia', label: 'Logo y colores', icon: 'palette', roles: ownerOnly },
  { path: 'dominios', label: 'Dominios', icon: 'language', roles: ownerOnly },
  { path: 'ajustes', label: 'Ajustes', icon: 'settings', roles: ownerOnly },
];
