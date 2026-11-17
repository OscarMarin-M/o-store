---
name: token-saver
description: Reglas para gastar menos tokens al trabajar en O-stores. Usar al empezar cualquier tarea en este repositorio, sobre todo antes de explorar código, ejecutar comandos con mucha salida o generar archivos.
---

# Ahorro de tokens

El gasto viene de tres sitios: lo que se lee, lo que devuelven los comandos y lo que se escribe. Recortar los tres sin perder calidad.

## Leer menos

- Buscar antes de leer: Grep o Glob para ubicar, y luego leer solo el rango de líneas necesario.
- No releer un archivo que ya está en la conversación ni uno recién editado.
- No abrir `node_modules`, `dist`, `.nx`, `.angular` ni `package-lock.json`. Si hace falta un dato de una dependencia, leer solo su `package.json` o el `.d.ts` concreto.
- `CLAUDE.md` ya describe estructura y comandos: no volver a explorar lo que dice ahí.

## Comandos con salida corta

- Filtrar en origen: `| Select-Object -Last 30`, `--silent`, `--no-fund --no-audit` en npm.
- En compilaciones y pruebas interesa el final y los errores, no el registro completo.
- Varias comprobaciones independientes van en una sola llamada o en paralelo, no una por turno.
- No pedir `--help` de un generador ya usado en el proyecto; las opciones usadas están en `nx.json`.

## Escribir menos

- Edit para cambios puntuales; Write solo para archivos nuevos o reescrituras completas.
- Usar los generadores de Nx en lugar de escribir a mano la estructura repetitiva.
- No crear documentos de plan, análisis o resumen que Oscar no haya pedido.
- Respuestas cortas: qué se hizo, qué falta y la explicación de modo learning en una o dos frases.

## Subagentes y modelo

- No lanzar subagentes salvo que Oscar lo pida: cada uno arranca sin contexto y repite lecturas.
- Tareas mecánicas largas (renombrar, mover, formatear) se resuelven con un comando, no archivo por archivo.

## Sesiones

- Una sesión por fase o tema. Al cambiar de tema, cerrar con `session-close` y empezar otra: `CLAUDE.md` y la memoria llevan el contexto sin arrastrar toda la conversación.
