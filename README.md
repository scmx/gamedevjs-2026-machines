# GameDevJS 2026 Machines

Upcoming Vanilla JS side scroller game with Kenney's New Platformer Pack assets
for Gamedev.js Jam 2026. https://scmx.itch.io/gamedevjs-2026

https://scmx.github.io/gamedevjs-2026-machines/

- 1-2 player support
- Gamepads support and keyboard support (Arrow keys and WASD)
- Sound effects via `zzfx` (TODO)
- Procedural level generation with deterministic seed
- In-game level editor (terrain, objects)
- Some kind of machinery

## Editor controls

Toggle editor mode with **B** (keyboard) or **B** on the gamepad (face button,
typically **east** on Xbox-style pads). Only **player 1** can use the editor.

### Keyboard (editor mode)

| Action                       | Key                                                              |
| ---------------------------- | ---------------------------------------------------------------- |
| Toggle editor on / off       | **B**                                                            |
| Move cursor                  | **Arrow keys**                                                   |
| Previous / next tool         | **Z** / **C** (tile, ladder, gem, key, lock, door)               |
| Cycle color (gem, key, lock) | **X**                                                            |
| Place                        | **F** — with **Tile** selected, toggles solid terrain on/off     |
| Remove                       | **V** — removes an object at the cursor, or clears solid terrain |

### Gamepad (editor mode)

| Action                       | Button                                           |
| ---------------------------- | ------------------------------------------------ |
| Toggle editor on / off       | **B**                                            |
| Move cursor                  | **D-pad**                                        |
| Previous / next tool         | **LB** / **RB**                                  |
| Cycle color (gem, key, lock) | **X**                                            |
| Place                        | **LT** (left trigger) — **Tile** toggles terrain |
| Remove                       | **RT** (right trigger)                           |

### Gameplay (not editing)

| Action               | Keyboard | Gamepad |
| -------------------- | -------- | ------- |
| Cycle character skin | **K**    | **X**   |
