---
name: ui-design
description: Dirección visual y reglas de UI/UX de O-stores para que las pantallas no parezcan una interfaz genérica hecha por IA. Usar antes de crear o modificar cualquier componente, página, layout, tema o estilo del admin o de las tiendas.
---

# Diseño de interfaz en O-stores

Estado: BORRADOR. La sección "Dirección visual" se completa con las referencias que elija Oscar. Hasta entonces, no fijar paleta ni tipografía definitivas: proponer y preguntar.

## Dos contextos distintos

- **Admin**: herramienta de trabajo. Prioriza densidad, lectura rápida y pocos clics. Sobrio; el color se reserva para estado y acciones.
- **Tiendas**: cada una tiene su propia identidad (la de cartas TCG no se parece a la de poleras). Comparten estructura y componentes de `libs/storefront/core`, pero no el aspecto. El tema de cada tienda sale de los tokens que define el admin.

## Dirección visual (pendiente de Oscar)

- Referencias: _por definir (2 o 3 sitios o apps que le gusten)_
- Tipografía de títulos y de texto: _por definir_
- Paleta base del admin: _por definir_
- Carácter: _por definir (por ejemplo: editorial, técnico, cálido, brutalista)_

## Proceso antes de escribir código

1. Decir en dos líneas qué tarea resuelve la pantalla y cuál es su acción principal.
2. Elegir la jerarquía: un solo elemento dominante por pantalla.
3. Usar tokens existentes (`--os-*`); si falta uno, crearlo en el tema, no escribir el valor suelto.
4. Diseñar todos los estados: vacío, cargando, error, sin permiso, y contenido largo.

## Patrones prohibidos (el aspecto genérico de IA)

- Degradados morado-azul, fondos con manchas difuminadas y efecto vidrio.
- Tipografía Inter, Roboto o la del sistema como única decisión tipográfica.
- Todo dentro de tarjetas con sombra suave y esquinas muy redondeadas; tarjetas dentro de tarjetas.
- Fila de tres tarjetas iguales con icono, título y frase.
- Emojis como iconos; iconos decorativos que no aportan significado.
- Todo centrado; secciones "hero" en una herramienta interna.
- Texto de relleno o grandilocuente ("Potencia tu negocio"). Los textos dicen qué hace el control.
- Paneles de métricas inventadas para llenar espacio.
- Animaciones de entrada en cada elemento.

## Reglas que sí

- Tokens CSS para color, espaciado, radio y tipografía. Escala de espaciado de 4 px.
- Como máximo dos familias tipográficas y una escala de tamaños corta.
- Un color de acento; grises con un matiz, no neutros puros.
- Bordes y alineación para separar, antes que sombras.
- Tablas reales para datos tabulares, con números alineados a la derecha en cifras tabulares.
- Radios pequeños y consistentes.
- Movimiento solo para explicar un cambio de estado, por debajo de 200 ms, y respetando `prefers-reduced-motion`.

## Usabilidad y accesibilidad

- Contraste AA, foco visible, navegación completa por teclado.
- Etiquetas visibles en los campos; el placeholder no sustituye a la etiqueta.
- Errores junto al campo y con la forma de corregirlos.
- Acciones destructivas con confirmación que nombra lo que se borra.
- Diseño adaptable: el admin usable desde 360 px de ancho; las tiendas, primero móvil.
- Textos de interfaz en español, en segunda persona informal y sin tecnicismos.

## Angular

- Angular Material 21 como base de comportamiento y accesibilidad, con el tema sobrescrito por tokens propios para que no se vea como Material por defecto.
- Componentes standalone, `ChangeDetectionStrategy.OnPush`, signals para estado, control de flujo `@if` / `@for`.
- Estilos en SCSS por componente; nada de colores o medidas sueltas fuera de los tokens.

## Revisión al terminar una pantalla

Levantar la app y mirar la pantalla real en ancho de escritorio y de móvil. Preguntarse: si se quita el logo, ¿se distingue de una plantilla cualquiera? Si no, falta una decisión de diseño.
