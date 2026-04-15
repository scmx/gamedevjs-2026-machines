import { TILE_SIZE } from "./game-state.js"

/** @type {readonly { id: string, label: string }[]} */
export const EDITOR_PLACEABLES = Object.freeze([
  { id: "ladder", label: "Ladder" },
])

const LADDER_HEIGHT_TILES = 3

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

  model._editorPrevPlace = Boolean(input.editorPlace)
  model._editorPrevRemove = Boolean(input.editorRemove)
  model._editorPrevCycleNext = Boolean(input.editorCycleNext)
  model._editorPrevCyclePrev = Boolean(input.editorCyclePrev)

  if (nextEdge) {
    model.editorThingIndex =
      (model.editorThingIndex + 1) % EDITOR_PLACEABLES.length
  }
  if (prevEdge) {
    model.editorThingIndex =
      (model.editorThingIndex - 1 + EDITOR_PLACEABLES.length) %
      EDITOR_PLACEABLES.length
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
    removeThingAtCursor(model)
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

  if (thing.id === "ladder") {
    const bottomY = model.editorTileY
    const topY = bottomY - (LADDER_HEIGHT_TILES - 1)
    if (topY < 0) return
    removeThingAtCursor(model)
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
  }
}

/**
 * @param {import('./game-state.js').GameModel} model
 */
function removeThingAtCursor(model) {
  const level = model.levels[0]
  if (!level) return
  const tx = model.editorTileX
  const ty = model.editorTileY
  const idx = level.objects.findIndex((o) => objectCoversTile(o, tx, ty))
  if (idx >= 0) {
    level.objects.splice(idx, 1)
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
