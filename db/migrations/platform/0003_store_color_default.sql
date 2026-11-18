-- Colores por defecto de tienda fuera de los reservados del admin.
-- El ámbar anterior (#f2b84b) se confundía con el de la acción principal (#e9b949).
-- Mismos valores que DEFAULT_STORE_PRIMARY y similarShade() en contracts/colors.ts.

alter table platform.stores
  alter column color_primary set default '#3d7f9e',
  alter column color_accent set default '#5d87bb';

-- Tiendas que conservaban los colores por defecto antiguos.
update platform.stores
set color_primary = '#3d7f9e',
    color_accent = '#5d87bb',
    updated_at = now()
where color_primary = '#f2b84b';
