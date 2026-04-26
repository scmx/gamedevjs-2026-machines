# GameDevJS 2026 Machines

Upcoming Vanilla JS side scroller game with Kenney's New Platformer Pack assets
for Gamedev.js Jam 2026. https://scmx.itch.io/gamedevjs-2026

https://scmx.github.io/gamedevjs-2026-machines/

- 1–2 player support
- Gamepads and keyboard
- Sound effects via `zzfx` (TODO)
- Procedural level generation with deterministic seed
- In-game level editor (terrain, fluids, objects)
- Editor changes are recorded as a list of operations on top of the procedural seed; use **Export** to save them

## Gameplay controls (not in editor)

### Keyboard — player 1

| Action | Key |
| ------ | --- |
| Move | **Arrow Left / Arrow Right** |
| Jump | **Arrow Up** |
| Move down (ladders / look down) | **Arrow Down** |
| Hit nearby block | **J** |
| Shoot | **K** |
| Cycle skin | **L** |
| Open menu | **P** |
| Toggle editor | **O** |

### Keyboard — player 2

| Action | Key |
| ------ | --- |
| Move | **A** / **D** |
| Jump | **W** |
| Move down | **S** |
| Hit nearby block | **F** |
| Shoot | **G** |
| Cycle skin | **Q** |

### Gamepad (gameplay)

| Action | Default mapping |
| ------ | ---------------- |
| Move | D-pad or left stick |
| Jump | South face (A on Xbox) |
| Hit nearby block | West (X on Xbox) |
| Shoot | North (Y on Xbox) |
| Cycle skin | D-pad Up (P1) / **X** (P2) |
| Menu | **Menu / Start** |
| Editor toggle | **View / Back** |

### Toolbar

| Control | Action |
| ------- | ------ |
| **Seed** | Single tap after a short delay: copies the current level seed to the clipboard. Double-tap quickly: rolls a new random seed and regenerates the level (clears recorded editor ops). |
| **Save edits (JSON)** | Downloads `level-edits-<seed>.json`: `{ v, seed, levelVersion, music, ops }`. The level is still generated from `seed`; `ops` are the edits to replay on top. |
| **Restart** | Full page reload |

## Editor controls

Toggle editor mode with **O** (keyboard) or **View / Back** on the gamepad. The menu opens with **P** on keyboard, or **Menu / Start** on the gamepad.

### Keyboard — editor mode

| Action | Key |
| ------ | --- |
| Toggle editor on / off | **O** |
| Open menu | **P** |
| Move cursor | **Arrow keys** |
| Previous / next tool | **Z** / **C** |
| Cycle color (gem, key, lock) or fluid / biome variant | **X** or **Q** |
| Place | **F** — with **Tile** selected, toggles solid terrain / biome paint |
| Remove | **V** or **Delete** — removes an object at the cursor, or clears solid terrain |

### Gamepad (editor mode)

| Action | Button |
| ------ | ------ |
| Toggle editor on / off | **View / Back** |
| Open menu | **Menu / Start** |
| Move cursor | **D-pad** |
| Previous / next tool | **LB** / **RB** |
| Cycle color / biome / fluid | **X** or **Y** (variant) |
| Place | **LT** (left trigger) — **Tile** toggles terrain |
| Remove | **RT** (right trigger) |

While the editor is active, movement and jump inputs are ignored so you can safely use the same keys for tools. Only one keyboard cursor is active in the editor.

Notes:
- `Hit nearby block` is the punch/interact action.
- `Shoot` fires a projectile.

## Development

```bash
npm test    # node --test (e.g. editor edit-log replay)
npm run lint
```
