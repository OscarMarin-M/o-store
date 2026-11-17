---
name: project-memory
description: Cómo gestionar la memoria persistente de O-stores, qué va en la memoria y qué en CLAUDE.md, y cómo limpiarla. Usar cuando Oscar pida recordar u olvidar algo, cuando corrija una forma de trabajar, al revisar la memoria y desde session-close.
---

# Memoria del proyecto

Hay dos lugares y cada dato vive en uno solo.

| Lugar | Qué guarda | Quién lo ve |
|---|---|---|
| `CLAUDE.md` (en el repo) | Stack, comandos, arquitectura acordada, reglas de datos, estado de las fases | Cualquiera que clone el repo; se versiona |
| Memoria (directorio que indica la sección "Memory" del prompt de la sesión) | Preferencias de Oscar, correcciones a la forma de trabajar, punteros a recursos externos, datos del entorno que no están en el repo | Solo las sesiones de Claude en este equipo |

Regla para decidir: si es verdad sobre el proyecto, va en `CLAUDE.md`. Si es verdad sobre cómo quiere trabajar Oscar o sobre algo externo al repo, va en la memoria.

## Qué se guarda en la memoria

- Correcciones y preferencias que cambian el comportamiento en sesiones futuras ("no uses X", "siempre pregunta antes de Y"), con el motivo.
- Referencias externas: URL del proyecto Supabase, del repositorio, paneles, documentación de pasarelas de pago elegidas.
- Decisiones de negocio que no se deducen del código: país y pasarela de pago, clientes interesados, prioridades entre tiendas.

## Qué no se guarda

- Lo que ya dice el repo: estructura, código, historial de git, contenido de `CLAUDE.md`.
- Estado pasajero: qué se hizo hoy, planes de la tarea en curso.
- Secretos: claves, contraseñas, tokens. Nunca.

## Cómo escribir una entrada

1. Revisar `MEMORY.md` por si ya existe una entrada sobre el tema; si existe, actualizarla en vez de duplicar.
2. Un archivo por dato, con el formato de frontmatter que define la sección "Memory" del prompt (`name`, `description`, `metadata.type`).
3. En entradas de tipo `feedback` y `project`, añadir las líneas **Why:** y **How to apply:**.
4. Fechas siempre absolutas (2026-11-17, no "ayer").
5. Añadir la línea de índice en `MEMORY.md`.

## Limpieza

Hacerla desde `session-close` o cuando Oscar la pida:

- Borrar entradas que resultaron falsas o que ya quedaron escritas en `CLAUDE.md`.
- Si una entrada nombra un archivo, comando o tabla, comprobar que sigue existiendo antes de confiar en ella.
- Fusionar entradas que digan lo mismo.
- Contar a Oscar en una línea qué se añadió, cambió o borró.
