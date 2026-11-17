---
name: session-close
description: Cierre de sesión de O-stores. Actualiza CLAUDE.md y la memoria del proyecto con lo que cambió. Usar cuando Oscar diga que termina la sesión o pida cerrar, y después de cada git push a main (un hook lo recuerda).
---

# Cierre de sesión

Objetivo: que la próxima sesión empiece sabiendo dónde quedó el proyecto sin releer la conversación.

## Pasos

1. Ver qué cambió: `git status --short` y `git log --oneline -10`. No releer archivos.
2. Actualizar `CLAUDE.md`, solo las partes afectadas:
   - **Estado**: qué fase o paso quedó hecho, qué sigue, qué está bloqueado y por qué.
   - **Stack / Comandos / Arquitectura / Reglas de datos**: solo si en la sesión se decidió o cambió algo de eso.
   - **Entorno**: problemas nuevos del equipo y su solución.
   Mantenerlo corto: reemplazar líneas viejas en vez de acumular historial. El historial está en git.
3. Actualizar la memoria siguiendo la skill `project-memory`: preferencias o correcciones nuevas de Oscar, referencias externas nuevas, y limpieza de entradas obsoletas.
4. Si `CLAUDE.md` cambió, dejarlo en un commit propio (`docs: actualizar estado del proyecto`). No hacer push sin que Oscar lo pida.
5. Responder a Oscar en pocas líneas: qué quedó hecho, qué sigue y qué se guardó en memoria.

## Cuándo no hace falta

Si desde el último cierre no hubo cambios de código, decisiones ni preferencias nuevas, decirlo en una línea y no tocar nada.
