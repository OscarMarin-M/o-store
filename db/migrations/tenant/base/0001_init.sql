-- Tablas que toda tienda tiene. Se aplican dentro del esquema tenant_<slug>
-- (el ejecutor fija search_path), por eso los nombres van sin calificar.

create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  parent_id uuid references categories (id) on delete set null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  price numeric(12, 2) not null check (price >= 0),
  stock integer not null default 0 check (stock >= 0),
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  category_id uuid references categories (id) on delete set null,
  images text[] not null default '{}',
  -- Solo lo variable de cada tienda; lo estable se promueve a columna.
  attributes jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_category_id_idx on products (category_id);
create index products_status_idx on products (status);

create table offers (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products (id) on delete cascade,
  discount_percent numeric(5, 2) not null check (discount_percent > 0 and discount_percent <= 100),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);

create index offers_product_id_idx on offers (product_id);

create table customers (
  id uuid primary key default gen_random_uuid(),
  -- Id del usuario en Supabase Auth. Sin clave foránea: la tienda puede vivir
  -- en otro proyecto (platform.stores.db_url).
  user_id uuid not null unique,
  name text,
  phone text,
  addresses jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table categories enable row level security;
alter table products enable row level security;
alter table offers enable row level security;
alter table customers enable row level security;
