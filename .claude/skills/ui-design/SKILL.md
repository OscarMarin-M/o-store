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

- Admin: _pendiente (se define al empezar la Fase 2)_
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

## Revisión al terminar una pantalla

Levantar la app y mirarla en escritorio y móvil, en oscuro y en claro. Si se quita el logo y no se distingue de una plantilla, falta una decisión de diseño.
