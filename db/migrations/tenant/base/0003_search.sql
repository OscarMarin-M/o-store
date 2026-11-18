-- Búsqueda de productos sin distinguir tildes ni mayúsculas, rápida con muchas filas.
--
-- unaccent quita tildes ("Ñandú" -> "Nandu") y pg_trgm indexa trozos de 3 letras,
-- lo que permite usar un índice en búsquedas "contiene" (like '%texto%').
-- Las extensiones son de toda la base; "if not exists" evita repetirlas por tienda.
-- En Supabase viven en el esquema "extensions".
create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- unaccent() no es "immutable" (depende de un diccionario configurable) y un índice
-- solo acepta funciones immutable: esta envoltura fija el diccionario.
-- Se crea en el esquema de la tienda, porque una tienda puede vivir en otra base.
create or replace function search_text(value text)
returns text
language sql
immutable
parallel safe
strict
as $$ select lower(extensions.unaccent('extensions.unaccent'::regdictionary, value)) $$;

-- Misma expresión que usa la API al buscar; si cambia una, cambiar la otra.
create index products_search_idx
  on products using gin (search_text(name || ' ' || code) extensions.gin_trgm_ops);
