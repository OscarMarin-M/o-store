-- Catálogo: ajustes de la tienda, código público, moneda por producto y variantes.
-- Se aplica dentro del esquema tenant_<slug> (search_path), sin calificar nombres.

-- Ajustes de la tienda: una sola fila (id siempre true).
create table settings (
  id boolean primary key default true check (id),
  -- Moneda en la que la tienda muestra los totales.
  currency text not null default 'BOB' check (currency in ('BOB', 'USD')),
  -- Prefijo del código público de productos: TCG -> TCG-0001.
  product_code_prefix text not null default 'P'
    check (product_code_prefix ~ '^[A-Z0-9]{1,8}$'),
  updated_at timestamptz not null default now()
);
insert into settings default values;

-- Contador del código público. Una secuencia nunca repite números, aunque se
-- creen dos productos a la vez.
create sequence product_code_seq;

alter table products
  add column code text,
  add column price_currency text not null default 'BOB'
    check (price_currency in ('BOB', 'USD')),
  -- Nombres de las opciones de variantes, en orden: {Talla, Color}. Vacío = sin variantes.
  add column option_names text[] not null default '{}'
    check (cardinality(option_names) <= 3);

-- Productos que ya existieran reciben código antes de exigirlo.
update products
set code = 'P-' || lpad(nextval('product_code_seq')::text, 4, '0')
where code is null;

alter table products
  alter column code set not null,
  add constraint products_code_key unique (code),
  add constraint products_code_format check (code ~ '^[A-Z0-9][A-Z0-9-]{0,39}$');

create table product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products (id) on delete cascade,
  -- Código propio: código del producto + valores, TCG-0012-M-NEGRO.
  code text not null unique check (code ~ '^[A-Z0-9][A-Z0-9-]{0,59}$'),
  -- Valores en el mismo orden que products.option_names: {M, Negro}.
  option_values text[] not null,
  -- null = usa el precio del producto (en su misma moneda).
  price numeric(12, 2) check (price >= 0),
  stock integer not null default 0 check (stock >= 0),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, option_values)
);

create index product_variants_product_id_idx on product_variants (product_id);

alter table settings enable row level security;
alter table product_variants enable row level security;
