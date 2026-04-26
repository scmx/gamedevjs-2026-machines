/**
 * Single source of truth for editor tools (count must match UI list in game-draw).
 * @typedef {{ id: string, label: string, colors?: boolean, biomes?: boolean, variants?: boolean, fluids?: boolean }} EditorPlaceable
 */

/** Expected tool count (stale caches served a shorter list; keep in sync). */
export const EDITOR_PLACEABLE_COUNT = 22

/** @type {readonly EditorPlaceable[]} */
export const EDITOR_PLACEABLES = Object.freeze([
  { id: "terrain", label: "Terrain", biomes: true },
  { id: "fluid", label: "Fluid", fluids: true },
  { id: "ladder", label: "Ladder" },
  { id: "bridge", label: "Bridge", variants: true },
  { id: "torch", label: "Torch" },
  { id: "rope", label: "Rope / chain", variants: true },
  { id: "rock", label: "Rock / weight", variants: true },
  { id: "gem", label: "Gem", colors: true },
  { id: "coin", label: "Coin", variants: true },
  { id: "key", label: "Key", colors: true },
  { id: "color_block", label: "Color block", colors: true },
  { id: "lock", label: "Lock", colors: true },
  { id: "exit_door", label: "Door" },
  { id: "spring", label: "Spring" },
  { id: "flag", label: "Flag", colors: true },
  { id: "conveyor", label: "Conveyor", variants: true },
  { id: "hazard", label: "Hazard", variants: true },
  { id: "spikes", label: "Spikes" },
  { id: "brick", label: "Brick", variants: true },
  { id: "switch", label: "Switch", colors: true },
  { id: "special_block", label: "Block", variants: true },
  { id: "bomb", label: "Bomb" },
])

if (EDITOR_PLACEABLES.length !== EDITOR_PLACEABLE_COUNT) {
  console.warn(
    "EDITOR_PLACEABLES length mismatch; reload with cache disabled or bump index.html ?v=",
    EDITOR_PLACEABLES.length,
    "expected",
    EDITOR_PLACEABLE_COUNT,
  )
}
