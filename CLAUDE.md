# O-stores

Plataforma multitienda: un administrador desde el que se crean y gestionan tiendas online independientes. Primeras tiendas: cartas Yu-Gi-Oh/TCG y poleras personalizadas. Proyecto personal que podría venderse a tiendas pequeñas y medianas. Mercado: Bolivia (precios en bolivianos, ejemplos de dominio `.com.bo`).

## Cómo trabajar con Oscar

- Responder en español.
- Modo learning: al crear o cambiar algo, explicar en una o dos frases qué es y por qué, sin frenar el avance. Oscar tiene algo de experiencia en desarrollo web.
- Ahorro de tokens: seguir la skill `token-saver`.
- Antes de crear o rediseñar interfaz: cargar las skills `ui-design` (encargo de Oscar) y `frontend-design` (método, oficial de Anthropic). Modo oscuro por defecto.
- Al terminar la sesión o tras un push a `main`: ejecutar la skill `session-close`.
- Pedir confirmación antes de acciones externas (push, crear repos, tocar el proyecto Supabase).
- Git: cada cambio se hace en su propia rama (`feat/...`, `fix/...`, `docs/...`) y nunca directamente en `main`. Al terminar y comprobar que funciona, se fusiona en `main` y se hace push (con confirmación).

## Stack

- Node 26.13.1 (ver `.nvmrc`; en este equipo `nvm use 26.13.1`), npm 11.
- Monorepo Nx 22.7. No subir a Nx 24 ni Angular 22 sin acordarlo: Oscar pidió Angular 21.
- `apps/admin`: Angular 21.2, SPA, standalone, zoneless, SCSS, prefijo de selectores `os`, pruebas con Vitest.
- `apps/api`: NestJS 11 (webpack).
- Supabase: Postgres, Auth y Storage. Sin Docker: se usa un proyecto Supabase en la nube para desarrollo.

## Comandos

- `npx nx serve admin` — admin en http://localhost:4200 (proxy de `/api` hacia la API). Arranca también la API; no lanzar `serve api` aparte o choca en el puerto 3000. Tras cambiar `project.json` hay que reiniciarlo.
- `npx nx serve api` — API en http://localhost:3000/api.
- `npx nx run-many -t build` — compilar todo.
- `npx nx test admin` / `npx nx test api` — pruebas (Vitest).
- `npx nx run api:migrate` — compila y aplica migraciones pendientes a `platform` y a cada tienda (toca Supabase: pedir confirmación).
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
- `PORT` en `.env` es el puerto de la API (3000, al que apunta el proxy del admin), no el de Postgres.
- Secretos en `.env` (ignorado por git). Nunca escribir claves en archivos versionados.

## Estado

- Fase 0: monorepo creado, `admin` y `api` compilan. Remoto `origin` = https://github.com/OscarMarin-M/o-store.git. `main` subido y con seguimiento de `origin/main`. Proyecto Supabase creado y `.env` completo.
- Fase 0.5: `CLAUDE.md`, skills y hook de cierre creados. Los planes de tokens visuales (admin y cada tienda) se definen al empezar su interfaz y se anotan en `ui-design`.
- Fase 1 (API base): código escrito, compila, lint limpio y 16 pruebas unitarias pasan (guards y ejecutor de migraciones). Incluye `libs/shared/contracts` (zod), migraciones en `db/migrations`, guards de sesión y roles, módulos `stores` y `memberships`, y `GET /api/public/stores/resolve?host=`. Probada contra Supabase con un flujo completo (crear tiendas, tema, dominios, `resolve`, roles y 403 entre tiendas). En la base de desarrollo existen `platform`, las tiendas `tcg` y `poleras` (`tenant_tcg`, `tenant_poleras`), el dominio verificado `tcg.localhost` y el `super_admin` de Oscar. Fase 1 terminada.
- Fase 2 (administrador): en curso. Dirección visual aprobada (ver `ui-design`). Hecho y subido: tokens y tema de Material, inicio de sesión con correo (Supabase iniciado con `GET /api/public/config`), guards por rol, layout con franja del color de la tienda activa y menú por rol (`apps/admin/src/app/store/store-sections.ts`), Plataforma > Tiendas (listar, crear, habilitar) y las secciones "Logo y colores" (subida a Storage con URL firmada, avisos de contraste) y "Dominios", y un diálogo de confirmación propio (`ConfirmService`). El resto de secciones de tienda muestran un aviso de pendiente; se conectan en `SECTION_PAGES` de `app.routes.ts`. Productos: lista con búsqueda y filtros (estado y categoría, `?categoria=`), formulario con fotos (varias, reordenables), precio en Bs o USD con equivalente, variantes y archivar; sección Ajustes (moneda y prefijo de código). Categorías: dos niveles, ordenar, editar, borrar (API `stores/:id/categories`, sin migración nueva). Piezas genéricas del admin en `apps/admin/src/app/ui` (`OS_UI`: formularios, avisos, color, subida, iconos Material Symbols); reglas en la skill `ui-design`. Listas paginadas genéricas (`ui/list`, `paginate`, `contracts/lists.ts`) hechas y aplicadas a Productos; migración `tenant/base/0003_search.sql` aplicada en `tcg` y `poleras`. Formato único de errores hecho (ver decisiones). Siguiente: atributos de los módulos `tcg` y `apparel` (con filtros sobre el contrato de listas) y luego pedidos (antes de crearlos: dinero en BOB, modelo de stock, edición simultánea con `updated_at` e historial). Pendiente: entrar con Google; poder volver a dejar el subdominio como principal; paginación por cursor cuando se hagan las tiendas públicas.

Decisiones de la Fase 2:

- Una sola app `admin`; el menú cambia según el rol. `super_admin` ve la sección Plataforma (tiendas, habilitar/deshabilitar, dominios, módulos, asignar dueños) y puede entrar a cualquier tienda. `store_owner` gestiona productos, pedidos, entregas, clientes y equipo de sus tiendas. `store_staff`: el día a día (productos, pedidos), sin equipo ni ajustes.
- Tema y logo: Oscar pone los iniciales; el dueño puede ajustar logo y colores desde el admin. Cambios de HTML/CSS que pida un cliente se hacen en el código de su app `apps/store-<nombre>`, por eso cada tienda es independiente.
- Dominios: el subdominio `<slug>.<PLATFORM_DOMAIN>` no se guarda en la base; `resolve` lo calcula desde el slug (en desarrollo `PLATFORM_DOMAIN=localhost`). Dominio propio: el dueño crea un TXT `_ostores.<dominio>` con un código HMAC del id del dominio (sin columna nueva) y la API lo comprueba en el DNS (`POST .../domains/:id/check`); `super_admin` puede forzar la verificación. Solo un dominio verificado puede ser principal; no se aceptan subdominios de la plataforma como dominio propio. `resolve` devuelve `primaryDomain` (dominio propio principal o subdominio) para que la tienda pública redirija con 301. HTTPS de dominios propios se decide en la fase de despliegue.
- Pendiente menor: validar el certificado de Supabase en la conexión Postgres (hoy cifra sin validar).
- Próxima sesión: seguir la Fase 2 (atributos de módulos, pedidos).
- Colores de tienda: dos parecidos, principal y secundario (`colorPrimary`, `colorAccent`), elegidos al crear la tienda; en el admin solo dan identidad. Ámbar, rojo y verde quedan reservados para componentes: `reservedColorIssue` (`libs/shared/contracts/src/colors.ts`) bloquea lo que se confunde, en el admin y en la API.
- Categorías: máximo dos niveles; la dirección (slug) no cambia al renombrar; no se borra una categoría con subcategorías; borrarla deja sus productos sin categoría.
- Catálogo (migración `tenant/base/0002_catalog.sql`): tabla `settings` de una fila por tienda (moneda, prefijo de código). Cada producto tiene un código público único `PREFIJO-0001` (secuencia `product_code_seq`, editable a mano) y sus variantes `PREFIJO-0001-M-NEGRO`; las reglas de códigos están en `libs/shared/contracts/src/codes.ts`. Variantes en `product_variants` (`option_names` en el producto, `option_values` en la variante, precio propio opcional). Precio en `BOB` o `USD` por producto.
- Tipo de cambio USD→BOB: `ExchangeRateService` con proveedores intercambiables y caché de 6 h; hoy solo el manual (`USD_BOB_RATE`). Falta el proveedor del Banco Central de Bolivia (confirmar su fuente de datos).
- Productos no se borran: se archivan, para que los pedidos antiguos conserven la referencia.
- Listas paginadas: contrato `listQuerySchema(sorts, defaults).extend({...})` y `Page<T>` en `contracts/lists.ts` (tamaños 25/50/100; orden declarado por lista, con desempate por `id`). En la API, `paginate()` (`common/paginate.ts`). En el admin, `injectListState` y `listData` (`ui/list`), con el estado en la URL. Por páginas en el admin; las tiendas públicas usarán cursor (scroll infinito). Búsqueda sin tildes con `search_text()` y un índice de trigramas (migración `tenant/base/0003_search.sql`; la expresión de la API y la del índice deben coincidir). Toda lista nueva (pedidos, clientes, atributos) usa este modelo.
- Errores: toda respuesta de error es un `ApiError` (`contracts/errors.ts`: `statusCode`, `code`, `message` en español sin punto final, `fields` por ruta `variants.0.price`, `requestId` en los 500). Lo produce el filtro global `ApiExceptionFilter` (`common/`); los servicios lanzan excepciones de Nest y, si el error es de un campo, `fieldError('campo', 'mensaje')`. En el admin: `apiMessage`, `apiFields(error, depth)` y `formErrors(fields, camposVisibles)` (`core/api-error.ts`); ningún error de campo puede quedar sin mostrarse.
- Dinero: los pedidos se cobran en BOB (el precio en USD de un producto se convierte y se congela en el pedido).
- Servicios externos (capa genérica con proveedores intercambiables, como `ExchangeRateService`): pago con QR mediante una pasarela externa, y facturación electrónica del SIN mediante una API externa, opcional por tienda. La facturación se deja para más adelante, pero el pedido ya pide NIT o CI y razón social.

Decisiones de la Fase 1:

- El JWT se valida con las claves públicas del proyecto (JWKS, librería `jose`). Si el proyecto firmara con secreto compartido, definir `SUPABASE_JWT_SECRET`.
- Toda ruta exige sesión salvo las marcadas `@Public()`. `@Roles(...)` compara contra el parámetro `:storeId`; `super_admin` pasa siempre.
- El logo se sube con una URL firmada que emite la API (`POST /stores/:storeId/logo-upload`); no hay políticas de Storage para usuarios.
- `resolve` solo devuelve tiendas habilitadas con dominio `verified`; solo un `super_admin` puede marcar un dominio como verificado.
- La API usa TypeScript `strict` (Kysely lo necesita).

Plan completo: `C:\Users\oscar\.claude\plans\hola-quiero-iniciar-un-refactored-pancake.md`.
