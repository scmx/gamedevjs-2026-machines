import { TILE_SIZE } from "./game-state.js"

/** @type {readonly string[]} */
export const EDITOR_COLORS = Object.freeze(["blue", "green", "red", "yellow"])

/**
 * @typedef {{ id: string, label: string, colors: boolean }} EditorPlaceable
 */

/** @type {readonly EditorPlaceable[]} */
export const EDITOR_PLACEABLES = Object.freeze([
  { id: "terrain", label: "Tile", colors: false },
  { id: "ladder", label: "Ladder", colors: false },
  { id: "gem", label: "Gem", colors: true },
  { id: "key", label: "Key", colors: true },
  { id: "lock", label: "Lock", colors: true },
  { id: "exit_door", label: "Door", colors: false },
])

const LADDER_HEIGHT_TILES = 3
const EXIT_DOOR_HEIGHT_TILES = 2
const LOCK_HEIGHT_TILES = 3

/**
 * @param {EditorPlaceable} thing
 * @returns {boolean}
 */
function thingHasColors(thing) {
  return thing.colors === true
}

/**
 * @param {import('./game-state.js').GameModel} model
 * @param {GameInput} input
 */
export function updateEditor(model, input) {
  const toggleEdge = Boolean(input.editorToggle && !model._editorPrevToggle)
  model._editorPrevToggle = Boolean(input.editorToggle)

  if (toggleEdge) {
    model.editorMode = !model.editorMode
    if (model.editorMode) {
      const p0 = model.players[0]
      if (p0) {
        model.editorTileX = clamp(
          Math.floor((p0.pos.x + p0.size.x / 2) / TILE_SIZE),
          0,
          getLevelWidth(model) - 1,
        )
        model.editorTileY = clamp(
          Math.floor((p0.pos.y + p0.size.y / 2) / TILE_SIZE),
          0,
          getLevelHeight(model) - 1,
        )
      }
    }
    return
  }

  if (!model.editorMode) return

  const placeEdge = Boolean(input.editorPlace && !model._editorPrevPlace)
  const removeEdge = Boolean(input.editorRemove && !model._editorPrevRemove)
  const nextEdge = Boolean(input.editorCycleNext && !model._editorPrevCycleNext)
  const prevEdge = Boolean(input.editorCyclePrev && !model._editorPrevCyclePrev)
  const colorEdge = Boolean(input.editorCycleColor && !model._editorPrevColor)

  model._editorPrevPlace = Boolean(input.editorPlace)
  model._editorPrevRemove = Boolean(input.editorRemove)
  model._editorPrevCycleNext = Boolean(input.editorCycleNext)
  model._editorPrevCyclePrev = Boolean(input.editorCyclePrev)
  model._editorPrevColor = Boolean(input.editorCycleColor)

  if (nextEdge) {
    model.editorThingIndex =
      (model.editorThingIndex + 1) % EDITOR_PLACEABLES.length
  }
  if (prevEdge) {
    model.editorThingIndex =
      (model.editorThingIndex - 1 + EDITOR_PLACEABLES.length) %
      EDITOR_PLACEABLES.length
  }

  const thing = EDITOR_PLACEABLES[model.editorThingIndex]
  if (colorEdge && thing && thingHasColors(thing)) {
    model.editorColorIndex = (model.editorColorIndex + 1) % EDITOR_COLORS.length
  }

  const moveEdgeU = Boolean(input.editorCursorUp && !model._editorPrevCursorUp)
  const moveEdgeD = Boolean(
    input.editorCursorDown && !model._editorPrevCursorDown,
  )
  const moveEdgeL = Boolean(
    input.editorCursorLeft && !model._editorPrevCursorLeft,
  )
  const moveEdgeR = Boolean(
    input.editorCursorRight && !model._editorPrevCursorRight,
  )

  model._editorPrevCursorUp = Boolean(input.editorCursorUp)
  model._editorPrevCursorDown = Boolean(input.editorCursorDown)
  model._editorPrevCursorLeft = Boolean(input.editorCursorLeft)
  model._editorPrevCursorRight = Boolean(input.editorCursorRight)

  const lw = getLevelWidth(model)
  const lh = getLevelHeight(model)
  if (moveEdgeU) model.editorTileY = clamp(model.editorTileY - 1, 0, lh - 1)
  if (moveEdgeD) model.editorTileY = clamp(model.editorTileY + 1, 0, lh - 1)
  if (moveEdgeL) model.editorTileX = clamp(model.editorTileX - 1, 0, lw - 1)
  if (moveEdgeR) model.editorTileX = clamp(model.editorTileX + 1, 0, lw - 1)

  if (placeEdge) {
    placeSelectedThing(model)
  }
  if (removeEdge) {
    removeAtCursor(model)
  }
}

/**
 * World-space center of editor cursor tile (for camera).
 *
 * @param {import('./game-state.js').GameModel} model
 * @returns {{ x: number, y: number }}
 */
export function getEditorFocusWorld(model) {
  return {
    x: (model.editorTileX + 0.5) * TILE_SIZE,
    y: (model.editorTileY + 0.5) * TILE_SIZE,
  }
}

/**
 * @param {import('./game-state.js').GameModel} model
 */
function placeSelectedThing(model) {
  const level = model.levels[0]
  if (!level) return
  const thing = EDITOR_PLACEABLES[model.editorThingIndex]
  if (!thing) return

  if (thing.id === "terrain") {
    toggleTerrainAtCursor(model)
    return
  }

  removeThingAtCursor(model)

  const c = EDITOR_COLORS[model.editorColorIndex] ?? "blue"

  if (thing.id === "ladder") {
    const bottomY = model.editorTileY
    const topY = bottomY - (LADDER_HEIGHT_TILES - 1)
    if (topY < 0) return
    level.objects.push({
      kind: "ladder",
      x: model.editorTileX,
      y: bottomY,
      width: 1,
      height: LADDER_HEIGHT_TILES,
      sprite: "ladder",
      collected: false,
      solid: false,
    })
    return
  }

  if (thing.id === "gem") {
    level.objects.push({
      kind: "gem",
      x: model.editorTileX,
      y: model.editorTileY,
      width: 1,
      height: 1,
      sprite: `gem_${c}`,
      collected: false,
    })
    return
  }

  if (thing.id === "key") {
    level.objects.push({
      kind: "key",
      x: model.editorTileX,
      y: model.editorTileY,
      width: 1,
      height: 1,
      sprite: `key_${c}`,
      collected: false,
    })
    return
  }

  if (thing.id === "lock") {
    const bottomY = model.editorTileY
    const topY = bottomY - (LOCK_HEIGHT_TILES - 1)
    if (topY < 0) return
    level.objects.push({
      kind: "lock",
      x: model.editorTileX,
      y: bottomY,
      width: 1,
      height: LOCK_HEIGHT_TILES,
      solid: true,
      sprite: `lock_${c}`,
      collected: false,
    })
    return
  }

  if (thing.id === "exit_door") {
    const bottomY = model.editorTileY
    const topY = bottomY - (EXIT_DOOR_HEIGHT_TILES - 1)
    if (topY < 0) return
    level.objects.push({
      kind: "exit_door",
      x: model.editorTileX,
      y: bottomY,
      width: 1,
      height: EXIT_DOOR_HEIGHT_TILES,
      solid: true,
      sprite: "exit_door",
      collected: false,
    })
  }
}

/**
 * @param {import('./game-state.js').GameModel} model
 */
function toggleTerrainAtCursor(model) {
  const level = model.levels[0]
  if (!level?.layers.terrain) return
  const x = model.editorTileX
  const y = model.editorTileY
  const rows = level.layers.terrain
  if (y < 0 || y >= rows.length) return
  const row = rows[y] ?? ""
  if (x < 0 || x >= row.length) return
  const chars = row.split("")
  const ch = chars[x]
  if (ch !== "1" && ch !== "0") return
  chars[x] = ch === "1" ? "0" : "1"
  rows[y] = chars.join("")
  model.terrainRevision += 1
}

/**
 * Remove one object covering cursor, else clear terrain cell to air.
 *
 * @param {import('./game-state.js').GameModel} model
 */
function removeAtCursor(model) {
  if (removeThingAtCursor(model)) {
    return
  }
  clearTerrainAtCursor(model)
}

/**
 * @param {import('./game-state.js').GameModel} model
 * @returns {boolean} True if an object was removed
 */
function removeThingAtCursor(model) {
  const level = model.levels[0]
  if (!level) return false
  const tx = model.editorTileX
  const ty = model.editorTileY
  const idx = level.objects.findIndex((o) => objectCoversTile(o, tx, ty))
  if (idx >= 0) {
    level.objects.splice(idx, 1)
    return true
  }
  return false
}

/**
 * @param {import('./game-state.js').GameModel} model
 */
function clearTerrainAtCursor(model) {
  const level = model.levels[0]
  if (!level?.layers.terrain) return
  const x = model.editorTileX
  const y = model.editorTileY
  const rows = level.layers.terrain
  if (y < 0 || y >= rows.length) return
  const row = rows[y] ?? ""
  if (x < 0 || x >= row.length) return
  const chars = row.split("")
  if (chars[x] === "1") {
    chars[x] = "0"
    rows[y] = chars.join("")
    model.terrainRevision += 1
  }
}

/**
 * @param {GameLevelObject} object
 * @param {number} tx
 * @param {number} ty
 * @returns {boolean}
 */
function objectCoversTile(object, tx, ty) {
  const left = object.x
  const right = object.x + object.width - 1
  const top = object.y - object.height + 1
  const bottom = object.y
  return tx >= left && tx <= right && ty >= top && ty <= bottom
}

/**
 * @param {import('./game-state.js').GameModel} model
 * @returns {number}
 */
function getLevelWidth(model) {
  return model.levels[0]?.width ?? 48
}

/**
 * @param {import('./game-state.js').GameModel} model
 * @returns {number}
 */
function getLevelHeight(model) {
  return model.levels[0]?.height ?? 12
}

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 */
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}
