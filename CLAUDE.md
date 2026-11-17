# O-stores

Plataforma multitienda: un administrador desde el que se crean y gestionan tiendas online independientes. Primeras tiendas: cartas Yu-Gi-Oh/TCG y poleras personalizadas. Proyecto personal que podría venderse a tiendas pequeñas y medianas.

## Cómo trabajar con Oscar

- Responder en español.
- Modo learning: al crear o cambiar algo, explicar en una o dos frases qué es y por qué, sin frenar el avance. Oscar tiene algo de experiencia en desarrollo web.
- Ahorro de tokens: seguir la skill `token-saver`.
- Antes de crear o rediseñar interfaz: cargar las skills `ui-design` (encargo de Oscar) y `frontend-design` (método, oficial de Anthropic). Modo oscuro por defecto.
- Al terminar la sesión o tras un push a `main`: ejecutar la skill `session-close`.
- Pedir confirmación antes de acciones externas (push, crear repos, tocar el proyecto Supabase).

## Stack

- Node 26.13.1 (ver `.nvmrc`; en este equipo `nvm use 26.13.1`), npm 11.
- Monorepo Nx 22.7. No subir a Nx 24 ni Angular 22 sin acordarlo: Oscar pidió Angular 21.
- `apps/admin`: Angular 21.2, SPA, standalone, zoneless, SCSS, prefijo de selectores `os`, pruebas con Vitest.
- `apps/api`: NestJS 11 (webpack).
- Supabase: Postgres, Auth y Storage. Sin Docker: se usa un proyecto Supabase en la nube para desarrollo.

## Comandos

- `npx nx serve admin` — admin en http://localhost:4200 (proxy de `/api` hacia la API).
- `npx nx serve api` — API en http://localhost:3000/api.
- `npx nx run-many -t build` — compilar todo.
- `npx nx test admin` / `npx nx test api` — pruebas (Vitest).
- `npx nx migrate api` — compila y aplica migraciones pendientes a `platform` y a cada tienda (toca Supabase: pedir confirmación).
- `node dist/apps/api/main.js --grant-super-admin <correo>` — da `super_admin` a una cuenta ya creada en Supabase Auth.
- `npx nx g @nx/angular:library --directory=libs/<ruta>` — nueva librería.

## Arquitectura acordada

```
apps/admin            panel del administrador
apps/api              única puerta a la base de datos
apps/store-<nombre>   una app Angular SSR por tienda (pendiente)
libs/shared/contracts tipos y DTOs compartidos front/API (pendiente)
libs/storefront/core  capa común que mejora a todas las tiendas (pendiente)
libs/ui               componentes compartidos (pendiente)
db/migrations/platform | tenant/base | tenant/modules/<modulo>   (pendiente)
```

Reglas de datos:

- Un esquema Postgres por tienda (`tenant_<slug>`) más el esquema `platform` (tiendas, dominios, membresías).
- Columnas normales para todo lo conocido; JSONB (`attributes`) solo para lo variable. Un atributo que se estabiliza se promueve a columna con una migración.
- Las funciones propias de una tienda son módulos: migraciones extra que solo se aplican a las tiendas que los activan.
- Los front nunca consultan tablas: usan Supabase solo para sesión y subida de imágenes. Todo dato pasa por la API, que usa Kysely con `withSchema` por petición.
- `platform.stores.db_url` opcional permite mover una tienda grande a su propio proyecto.

Roles: `super_admin`, `store_owner`, `store_staff` (en `platform.memberships`) y `customer` (ficha en `tenant_<slug>.customers`; debe iniciar sesión para comprar, con Google o correo).

## Entorno

- La carpeta está dentro de OneDrive. Si `npm install` falla por archivos bloqueados, pausar OneDrive y reintentar.
- nvm-windows 1.1.10 no puede descargar versiones nuevas de Node; se instalan copiando el zip oficial a `%APPDATA%\nvm\v<versión>`.
- npm 11 no ejecuta scripts de instalación de dependencias sin aprobarlos (`npm install-scripts`); hasta ahora no ha hecho falta.
- Git no traía gestor de credenciales configurado; este repo usa `credential.helper=manager` (config local), con lo que Claude puede hacer push desde su shell. Sigue pidiendo confirmación antes.
- `DATABASE_URL` debe ser la del Session pooler (`...pooler.supabase.com`, usuario `postgres.<ref>`); la conexión directa `db.<ref>.supabase.co` es solo IPv6 y no resuelve desde este equipo.
- Oscar prefiere ejecutar él mismo en el SQL Editor los cambios de estructura sobre `platform`: pasarle el SQL (incluyendo el registro en `platform.schema_migrations`).
- Secretos en `.env` (ignorado por git). Nunca escribir claves en archivos versionados.

## Estado

- Fase 0: monorepo creado, `admin` y `api` compilan. Remoto `origin` = https://github.com/OscarMarin-M/o-store.git. `main` subido y con seguimiento de `origin/main`. Proyecto Supabase creado y `.env` completo.
- Fase 0.5: `CLAUDE.md`, skills y hook de cierre creados. Los planes de tokens visuales (admin y cada tienda) se definen al empezar su interfaz y se anotan en `ui-design`.
- Fase 1 (API base): código escrito, compila, lint limpio y 16 pruebas unitarias pasan (guards y ejecutor de migraciones). Incluye `libs/shared/contracts` (zod), migraciones en `db/migrations`, guards de sesión y roles, módulos `stores` y `memberships`, y `GET /api/public/stores/resolve?host=`. Probada contra Supabase con un flujo completo (crear tiendas, tema, dominios, `resolve`, roles y 403 entre tiendas). En la base de desarrollo existen `platform`, las tiendas `tcg` y `poleras` (`tenant_tcg`, `tenant_poleras`), el dominio verificado `tcg.localhost` y el `super_admin` de Oscar. Fase 1 terminada.
- Fase 2 (administrador): sin empezar; es lo siguiente.
- Pendientes menores: validar el certificado de Supabase en la conexión Postgres (hoy cifra sin validar); cambiar la contraseña débil del `super_admin` de desarrollo.

Decisiones de la Fase 1:

- El JWT se valida con las claves públicas del proyecto (JWKS, librería `jose`). Si el proyecto firmara con secreto compartido, definir `SUPABASE_JWT_SECRET`.
- Toda ruta exige sesión salvo las marcadas `@Public()`. `@Roles(...)` compara contra el parámetro `:storeId`; `super_admin` pasa siempre.
- El logo se sube con una URL firmada que emite la API (`POST /stores/:storeId/logo-upload`); no hay políticas de Storage para usuarios.
- `resolve` solo devuelve tiendas habilitadas con dominio `verified`; solo un `super_admin` puede marcar un dominio como verificado.
- La API usa TypeScript `strict` (Kysely lo necesita).

Plan completo: `C:\Users\oscar\.claude\plans\hola-quiero-iniciar-un-refactored-pancake.md`.
