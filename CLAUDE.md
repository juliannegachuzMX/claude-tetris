# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Tetris implementado en JavaScript vanilla (HTML5 Canvas, CSS, sin dependencias, sin build). Tres archivos:

- `index.html` — DOM, canvas del tablero (`#board`, 300×600) y canvas de la siguiente pieza (`#next-canvas`, 120×120), panel lateral (score/lines/level), overlay de pausa/game over.
- `style.css` — tema dark/retro arcade.
- `game.js` — toda la lógica del juego (~300 líneas), arquitectura de un solo archivo sin módulos.

## Running the game

No hay build ni tests. Para jugar, abrir `index.html` directamente o servir con cualquier servidor estático:

```bash
python3 -m http.server 8000
```

## Architecture (game.js)

- **Estado global**: variables sueltas a nivel de módulo (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, etc.) — no hay clases ni store.
- **Tablero**: matriz `ROWS × COLS` (20×10), cada celda es `0` (vacía) o índice 1-7 que mapea a `COLORS`/`PIECES`.
- **Piezas**: matrices cuadradas en `PIECES`. La rotación (`rotateCW`) es transposición + reverso de filas; `tryRotate` aplica wall kicks probando offsets `[0, -1, 1, -2, 2]`.
- **Colisión** (`collide`): única función que valida límites del tablero y solapamiento con celdas fijadas; reutilizada por movimiento, rotación, ghost piece y spawn.
- **Game loop** (`loop`): basado en `requestAnimationFrame`, acumula `dt` en `dropAccum` y baja la pieza cuando supera `dropInterval`.
- **Fijado de pieza** (`lockPiece` → `merge` + `clearLines` + `spawn`): al tocar fondo, la pieza se escribe en `board`, se limpian líneas completas (de abajo hacia arriba, re-evaluando la misma fila tras eliminar) y se genera la siguiente pieza.
- **Puntuación/nivel**: `LINE_SCORES = [0,100,300,500,800]` × `level`; nivel sube cada 10 líneas; `dropInterval = max(100, 1000 - (level-1)*90)`.
- **Renderizado**: `draw()` dibuja grid + tablero + ghost piece (alpha 0.2, posición calculada por `ghostY()`) + pieza actual; `drawNext()` dibuja la pieza siguiente en su propio canvas.
- **Input**: un único listener `keydown` global maneja movimiento, rotación, soft/hard drop y pausa (`P`).

## Tunable constants (game.js)

`COLS`, `ROWS`, `BLOCK`, `COLORS`, `LINE_SCORES`, `dropInterval` inicial. Si se cambia `COLS`/`ROWS`/`BLOCK`, ajustar también `width`/`height` de `<canvas id="board">` en `index.html` (`COLS × BLOCK` y `ROWS × BLOCK`).

## Pull requests

Si un PR resuelve un issue, usar el keyword de cierre en inglés (`Closes #N`, `Fixes #N` o `Resolves #N`) en el cuerpo del PR — GitHub solo auto-cierra issues con esos keywords en inglés, "Cierra #N" no funciona. El resto del PR puede estar en español.
