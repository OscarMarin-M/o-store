-- Bucket público para logos e imágenes de tienda: store-assets/<store_id>/...
-- Lectura pública; las subidas solo con URL firmada que emite la API.

insert into storage.buckets (id, name, public)
values ('store-assets', 'store-assets', true)
on conflict (id) do nothing;
