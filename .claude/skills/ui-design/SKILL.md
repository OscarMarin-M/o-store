---
name: ui-design
description: Encargo de diseño de O-stores (lo que Oscar pidió) y reglas de UX e implementación en Angular. Usar junto con la skill frontend-design antes de crear o modificar cualquier componente, página, layout, tema o estilo del admin o de las tiendas.
---

# Diseño de interfaz en O-stores

Esta skill es el encargo del cliente. El método de diseño (plan de tokens, revisión contra lo genérico, autocrítica, redacción de textos) está en la skill `frontend-design`, oficial de Anthropic: cargarla siempre junto con esta. Si chocan, manda lo que dice aquí, porque es lo que pidió Oscar.

## Encargo de Oscar (2026-11-17)

- No tiene sitios de referencia. Lo único innegociable: que no parezca una interfaz genérica generada por IA.
- Modo oscuro por defecto en admin y tiendas. El tema claro existe como alternativa, con los mismos tokens.
- Animaciones en las tiendas.
- Flujo cómodo para comprar y para subir archivos.

## Dos contextos

- **Admin**: herramienta de trabajo para gestionar tiendas. Denso, sobrio, pocos clics. Sin animación decorativa.
- **Tiendas**: cada una con identidad propia sacada de lo que vende (cartas TCG y poleras personalizadas no se parecen). Comparten estructura y componentes de `libs/storefront/core`, no el aspecto. Los colores y el logo vienen del tema que define el admin.

## Plan de tokens

Antes de la primera pantalla de cada app, hacer el plan de dos pasadas de `frontend-design` (paleta de 4 a 6 colores con nombre, tipografías y su papel, concepto de layout, principios), enseñárselo a Oscar y anotar aquí el resultado aprobado.

Cuidado con el modo oscuro: "fondo casi negro con un único acento ácido" es uno de los aspectos por defecto que `frontend-design` señala. Oscuro no significa negro: elegir un fondo con color propio del tema de cada app.

- Admin (aprobado 2026-11-17):
  - Idea central: el admin toma el color de la tienda activa (franja superior y marca en el selector de tiendas). Es lo único llamativo; el resto es sobrio.
  - Oscuro: Pizarra `#1C2624` (fondo), Mesa `#243230` (paneles), Grafito `#3A4A47` (bordes), Papel `#E6E9E2` (texto), Ceniza `#9AA8A3` (texto secundario), Ámbar etiqueta `#E9B949` (solo la acción principal de cada pantalla). Claro: los mismos tokens invertidos.
  - Tipografía: Atkinson Hyperlegible Next para todo, cifras tabulares alineadas a la derecha; Atkinson Hyperlegible Mono solo para SKU, dominios y slugs.
  - Layout: barra lateral con selector de tiendas y menú; contenido en tablas y listas alineadas a la izquierda, no cuadrícula de tarjetas. En móvil, selector arriba y menú desplegable.
  - Elevación por superficies más claras, sin sombras. Radio 4 px en campos, 8 px en paneles. Sin animación decorativa.
- Tienda TCG: _pendiente_
- Tienda poleras: _pendiente_

## Animación en las tiendas

- Un momento orquestado por página (la entrada del producto destacado, la apertura de una carta), no aparición con desvanecido en cada sección.
- Animar la respuesta a acciones: añadir al carrito, cambiar variante, abrir galería, pasar de paso en el pago, completar una subida.
- Transiciones entre páginas con la View Transitions API del router de Angular (`withViewTransitions`), por ejemplo la imagen del producto que viaja de la lista al detalle.
- Solo `transform` y `opacity`; respuestas a acciones por debajo de 250 ms.
- Respetar `prefers-reduced-motion`: sin movimiento, el contenido sigue completo.

## Flujo de compra

- Añadir al carrito sin salir de la página; el carrito se abre como panel lateral.
- Navegar es libre; la sesión (Google o correo) se pide al pagar, conservando el carrito.
- Pago en una sola página con pasos visibles; no pedir ningún dato dos veces; recordar dirección y contacto.
- Precio total con envío visible antes del último paso; sin costes sorpresa.
- Errores junto al campo, sin borrar lo ya escrito.
- Pantalla de confirmación con número de pedido y qué pasa después.

## Subida de archivos (logos, fotos de producto, diseños de poleras)

- Arrastrar y soltar, pegar desde el portapapeles y botón de selección; en móvil, cámara o galería.
- Vista previa inmediata, antes de que termine la subida.
- Progreso por archivo, con cancelar y reintentar; un fallo no tumba el resto.
- Validar tipo y peso antes de subir, diciendo el límite y cómo cumplirlo.
- Varias imágenes a la vez, reordenables arrastrando; la primera es la portada.
- Recorte y encuadre en el navegador cuando la proporción importa (logo, portada).

## Usabilidad y accesibilidad

- Contraste AA en ambos temas, foco visible, navegación completa por teclado.
- Etiquetas visibles en los campos; el placeholder no sustituye a la etiqueta.
- Acciones destructivas con confirmación que nombra lo que se borra.
- Todos los estados diseñados: vacío, cargando, error, sin permiso, contenido largo.
- Admin usable desde 360 px de ancho; tiendas, primero móvil.
- Textos en español, segunda persona informal, sin tecnicismos.

## Angular

- Tokens CSS con prefijo `--os-` para color, espaciado, radio y tipografía; nada de valores sueltos en componentes.
- Tema oscuro en `:root`; tema claro bajo `[data-theme="light"]`.
- Angular Material 21 como base de comportamiento y accesibilidad, con el tema sobrescrito por los tokens propios.
- Componentes standalone, `OnPush`, signals, control de flujo `@if` / `@for`, SCSS por componente.
- Piezas genéricas del admin en `apps/admin/src/app/ui/`; se importan juntas con `OS_UI` (`ui/ui.ts`). No rehacerlas por pantalla:
  - Formularios: nunca campos sueltos ni `mat-form-field`. `os-form-section` (panel con `heading`, `description`, `icon` y cuadrícula de 6 columnas; pie con `osFormActions`). Su encabezado lleva superficie más clara, franja izquierda degradada con los dos colores de la tienda y pastilla del icono; toda sección lleva icono. La etiqueta de cada `os-field` es una pestaña ("etiqueta de precio") pegada al control, teñida con el color secundario y con el principal al escribir; texto siempre del color normal. `os-field` (`label`, `hint` con ejemplo, `error`, `optional`, `span`, `prefix`/`suffix`, `icon`, `labelHidden` para búsquedas y filtros) con `osControl` en el input, select o textarea. Radios y casillas con explicación: `os-choices` / `os-choice` y `os-check` (`form/_form.scss`). Toda etiqueta que no sea obvia lleva una ayuda con ejemplo ("Ej.: …").
  - Avisos: `os-notice kind="ok|error|info|warning"`, con icono propio; no párrafos coloreados.
  - Colores: `os-color-input` (muestra + hex) dentro de un `os-field`.
- Colores de tienda en el admin (acordado con Oscar 2026-11-17): cada tienda tiene dos colores parecidos, principal y secundario (`colorPrimary`, `colorAccent`), elegidos al crearla; el secundario se propone con `similarShade`. En el admin son `--os-store-color` y `--os-store-color-2` y solo dan identidad (franjas, marcas, pestañas de etiqueta). Reservados para componentes, nunca colores de tienda: ámbar (acción principal y foco), rojo (errores, borrar), verde (confirmaciones). `reservedColorIssue` (`contracts/colors.ts`) bloquea lo que se confunde y avisa de lo parecido; lo aplican el admin y la API.
  - Subida de archivos: clase `os-drop` con `os-drop-icon` (`_drop.scss`).
  - Listas largas (`ui/list`): nunca cargar todo ni paginar a mano.
    - Estado con `injectListState({ sorts, sort, dir, firstDir, filters })`. Búsqueda, filtros, orden y página viven en la URL (`buscar`, `pagina`, `por_pagina`, `orden`, `dir` y los filtros propios con nombre en español); los valores por defecto no se escriben.
    - Datos con `listData(request, loader, { state })`: solo cuenta la última respuesta y se conserva la página anterior atenuada mientras carga.
    - Marcado: barra `os-list-toolbar` (búsqueda con `os-field labelHidden icon="search"` y `list.search()`, filtros de un clic en `os-segmented` con `aria-pressed`). Tabla `os-panel os-table-wrap` > `table.os-table`, con encabezados `th[osSort][list]`, `os-num` en cifras, `os-cell-media` y `os-cell-main`, y `data-label` en lo que necesite rótulo en móvil (allí cada fila pasa a tarjeta). Pie `<os-pager [list] [data] noun="…">`.
    - Estados: con filtros y sin resultados, "Quitar filtros" (`list.clearFilters()`); sin nada, invitar a crear el primero.
  - Fechas con `formatDay` (`core/dates.ts`, hora de La Paz) y dinero con `formatMoney` (`core/money.ts`); no usar pipes con el locale por defecto.
  - Iconos: Material Symbols Outlined (paquete `material-symbols`, servido desde el proyecto) con `<mat-icon>nombre</mat-icon>`, 20 px. En botones de texto, icono delante de la acción (add, edit, delete, check para guardar, refresh para reintentar). Botón solo de icono únicamente donde no cabe texto, siempre con `aria-label` y `title`. Icono decorativo con `aria-hidden="true"`. En el menú, cada sección tiene su `icon` en `store-sections.ts`; la activa se rellena (FILL 1).
  - Solo en el admin y en piezas generales. Las tiendas definen su propia iconografía con su identidad; si usan Material Symbols, servir un subconjunto con los iconos usados (la fuente completa pesa 4 MB).

## Revisión al terminar una pantalla

Levantar la app y mirarla en escritorio y móvil, en oscuro y en claro. Si se quita el logo y no se distingue de una plantilla, falta una decisión de diseño.
