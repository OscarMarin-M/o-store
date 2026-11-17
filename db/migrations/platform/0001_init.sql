-- Esquema platform: tiendas, dominios y membresías.
-- El ejecutor crea el esquema y fija search_path, por eso los nombres van sin calificar.

create table stores (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  enabled boolean not null default true,
  modules text[] not null default '{}',
  schema_name text not null unique,
  db_url text,
  logo_path text,
  color_primary text not null default '#f2b84b',
  color_accent text not null default '#4bd6c2',
  color_background text not null default '#111318',
  theme jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table store_domains (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores (id) on delete cascade,
  domain text not null unique,
  is_primary boolean not null default false,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

create index store_domains_store_id_idx on store_domains (store_id);
create unique index store_domains_one_primary_idx on store_domains (store_id) where is_primary;

create table memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  store_id uuid references stores (id) on delete cascade,
  role text not null check (role in ('super_admin', 'store_owner', 'store_staff')),
  created_at timestamptz not null default now(),
  -- super_admin es de plataforma (sin tienda); los demás roles pertenecen a una tienda.
  check ((role = 'super_admin') = (store_id is null))
);

create unique index memberships_user_store_idx on memberships (user_id, store_id) nulls not distinct;
create index memberships_store_id_idx on memberships (store_id);

-- Solo la API (dueña de las tablas) llega a estos datos. RLS sin políticas
-- bloquea a cualquier otro rol aunque algún día se exponga el esquema.
alter table stores enable row level security;
alter table store_domains enable row level security;
alter table memberships enable row level security;
