// @ts-nocheck
import { EDITOR_BLOCK_VARIANTS } from "./editor-block-variants.js"
import { EDITOR_BRICK_VARIANTS } from "./editor-brick-variants.js"
import { EDITOR_COIN_VARIANTS } from "./editor-coin-variants.js"
import {
  EDITOR_BRIDGE_VARIANTS,
  EDITOR_ROCK_VARIANTS,
  EDITOR_ROPE_VARIANTS,
} from "./editor-decor-variants.js"
import { EDITOR_HAZARD_VARIANTS } from "./editor-hazard-variants.js"
import {
  LADDER_PLACE_HEIGHT,
  mergeLadderPlacement,
  removeLadderSegmentAtTile,
} from "./editor-ladder.js"
import { EDITOR_PLACEABLES } from "./editor-placeables.js"
import { appendEditLog } from "./editor-edit-log.js"
import { applyTerrainToggle, clearTerrainCell } from "./editor-terrain-ops.js"
import { TILE_SIZE } from "./game-state.js"
import { cycleEditorLevel, undoLastEditAndReload } from "./game-update.js"
import {
  floodFluidPlaceDown,
  floodFluidRemoveUp,
} from "./terrain-fluid.js"
import { biomeToChar, ensureTerrainVariant, TERRAIN_BIOMES } from "./terrain-biome.js"

export {
  EDITOR_BLOCK_VARIANTS,
  EDITOR_BRICK_VARIANTS,
  EDITOR_COIN_VARIANTS,
  EDITOR_HAZARD_VARIANTS,
  EDITOR_PLACEABLES,
}

/** @type {readonly string[]} */
export const EDITOR_COLORS = Object.freeze(["blue", "green", "red", "yellow"])

/** Biome index → char (same order as {@link TERRAIN_BIOMES}). */
export const EDITOR_BIOME_CHARS = Object.freeze(
  TERRAIN_BIOMES.map((b) => biomeToChar(b)),
)

/**
 * @param {import('./game-state.js').GameModel} model
 * @param {GameLevelObject} obj
 */
function pushObjectAndLog(model, obj) {
  const level = model.levels[0]
  if (!level) return
  level.objects.push(obj)
  appendEditLog(model, {
    op: "objectAdd",
    obj: JSON.parse(JSON.stringify(obj)),
  })
}

const EXIT_DOOR_HEIGHT_TILES = 2
/** Editor lock is a single tile (procedural levels may stack separate objects). */
const EDITOR_LOCK_HEIGHT_TILES = 1

/**
 * @param {import('./editor-placeables.js').EditorPlaceable} thing
 * @returns {boolean}
 */
function thingHasColors(thing) {
  return thing.colors === true
}

/**
 * @param {import('./editor-placeables.js').EditorPlaceable} thing
 * @returns {boolean}
 */
function thingHasBiomes(thing) {
  return thing.biomes === true
}

/**
 * @param {import('./game-state.js').GameModel} model
 * @param {number} pi
 */
function normalizeEditorThingIndex(model, pi) {
  const n = EDITOR_PLACEABLES.length
  if (n <= 0) return
  model.editorThingIndex[pi] = ((model.editorThingIndex[pi] % n) + n) % n
}

/**
 * @param {import('./game-state.js').GameModel} model
 * @param {import('./editor-placeables.js').EditorPlaceable | undefined} thing
 * @param {number} pi
 */
function syncEditorPaletteFromThing(model, thing, pi) {
  if (!thing) return
  if (thingHasColors(thing)) {
    const map = model.editorColorsById[pi]
    const stored = map[thing.id]
    if (stored !== undefined) {
      model.editorColorIndex[pi] = stored
    }
  }
}

/**
 * @param {import('./game-state.js').GameModel} model
 * @param {string} thingId
 * @param {number} pi
 */
function getEditorColorForPlaceable(model, thingId, pi) {
  const map = model.editorColorsById[pi]
  let i = map[thingId]
  if (i === undefined) {
    i = model.editorColorIndex[pi]
    map[thingId] = i
  }
  return EDITOR_COLORS[i] ?? "blue"
}

/** @type {GameInput} */
const EMPTY_EDITOR_INPUT = Object.freeze({
  cycleSkin: false,
  down: false,
  jump: false,
  left: false,
  right: false,
  shoot: false,
  punchBlock: false,
  editorToggle: false,
  editorPlace: false,
  editorRemove: false,
  editorUndo: false,
  editorLevelNext: false,
  editorLevelPrev: false,
  editorCycleNext: false,
  editorCyclePrev: false,
  editorCycleColor: false,
  editorCursorUp: false,
  editorCursorDown: false,
  editorCursorLeft: false,
  editorCursorRight: false,
})

/**
 * B on either player toggles editor for everyone. While active, each player has
 * their own cursor and tool selection.
 *
 * @param {import('./game-state.js').GameModel} model
 * @param {GameInput[]} inputs
 */
export function updateEditors(model, inputs) {
  const p0 = inputs[0] ?? EMPTY_EDITOR_INPUT
  const p1 = inputs[1] ?? EMPTY_EDITOR_INPUT

  const anyToggle = Boolean(p0.editorToggle || p1.editorToggle)
  const toggleEdge = Boolean(anyToggle && !model._editorPrevToggleAny)
  model._editorPrevToggleAny = anyToggle

  if (toggleEdge) {
    model.editorMode = !model.editorMode
    if (model.editorMode) {
      const n = Math.min(model.players.length, 2)
      for (let pi = 0; pi < n; pi++) {
        normalizeEditorThingIndex(model, pi)
        syncEditorPaletteFromThing(
          model,
          EDITOR_PLACEABLES[model.editorThingIndex[pi]],
          pi,
        )
        const self = model.players[pi]
        if (self) {
          model.editorTileX[pi] = clamp(
            Math.floor((self.pos.x + self.size.x / 2) / TILE_SIZE),
            0,
            getLevelWidth(model) - 1,
          )
          model.editorTileY[pi] = clamp(
            Math.floor((self.pos.y + self.size.y / 2) / TILE_SIZE),
            0,
            getLevelHeight(model) - 1,
          )
        }
      }
    }
    return
  }

  if (!model.editorMode) return

  model.editorCursorMovedThisFrame[0] = false
  model.editorCursorMovedThisFrame[1] = false

  updateEditorPlayer(model, p0, 0)
  updateEditorPlayer(model, p1, 1)
}

/**
 * @param {import('./game-state.js').GameModel} model
 * @param {GameInput} input
 * @param {number} playerIndex
 */
function updateEditorPlayer(model, input, playerIndex) {
  const pi = playerIndex

  normalizeEditorThingIndex(model, pi)

  const placeEdge = Boolean(input.editorPlace && !model._editorPrevPlace[pi])
  const removeEdge = Boolean(input.editorRemove && !model._editorPrevRemove[pi])
  const undoEdge = Boolean(input.editorUndo && !model._editorPrevUndo[pi])
  const levelNextEdge = Boolean(
    input.editorLevelNext && !model._editorPrevLevelNext[pi],
  )
  const levelPrevEdge = Boolean(
    input.editorLevelPrev && !model._editorPrevLevelPrev[pi],
  )
  const nextEdge = Boolean(
    input.editorCycleNext && !model._editorPrevCycleNext[pi],
  )
  const prevEdge = Boolean(
    input.editorCyclePrev && !model._editorPrevCyclePrev[pi],
  )
  const colorEdge = Boolean(input.editorCycleColor && !model._editorPrevColor[pi])

  model._editorPrevPlace[pi] = Boolean(input.editorPlace)
  model._editorPrevRemove[pi] = Boolean(input.editorRemove)
  model._editorPrevUndo[pi] = Boolean(input.editorUndo)
  model._editorPrevLevelNext[pi] = Boolean(input.editorLevelNext)
  model._editorPrevLevelPrev[pi] = Boolean(input.editorLevelPrev)
  model._editorPrevCycleNext[pi] = Boolean(input.editorCycleNext)
  model._editorPrevCyclePrev[pi] = Boolean(input.editorCyclePrev)
  model._editorPrevColor[pi] = Boolean(input.editorCycleColor)

  if (nextEdge) {
    model.editorThingIndex[pi] =
      (model.editorThingIndex[pi] + 1) % EDITOR_PLACEABLES.length
  }
  if (levelNextEdge) {
    cycleEditorLevel(model, 1)
    return
  }
  if (levelPrevEdge) {
    cycleEditorLevel(model, -1)
    return
  }
  if (prevEdge) {
    model.editorThingIndex[pi] =
      (model.editorThingIndex[pi] - 1 + EDITOR_PLACEABLES.length) %
      EDITOR_PLACEABLES.length
  }
  if (nextEdge || prevEdge) {
    normalizeEditorThingIndex(model, pi)
    syncEditorPaletteFromThing(
      model,
      EDITOR_PLACEABLES[model.editorThingIndex[pi]],
      pi,
    )
  }

  const thing = EDITOR_PLACEABLES[model.editorThingIndex[pi]]
  if (colorEdge && thing) {
    if (thingHasBiomes(thing)) {
      model.editorBiomeIndex[pi] =
        (model.editorBiomeIndex[pi] + 1) % TERRAIN_BIOMES.length
    } else if (thingHasColors(thing)) {
      const id = thing.id
      const map = model.editorColorsById[pi]
      const cur = map[id] ?? model.editorColorIndex[pi]
      const next = (cur + 1) % EDITOR_COLORS.length
      map[id] = next
      model.editorColorIndex[pi] = next
    } else if (thing.id === "special_block") {
      model.editorBlockVariantIndex[pi] =
        (model.editorBlockVariantIndex[pi] + 1) % EDITOR_BLOCK_VARIANTS.length
    } else if (thing.id === "bridge") {
      model.editorBridgeVariantIndex[pi] =
        (model.editorBridgeVariantIndex[pi] + 1) % EDITOR_BRIDGE_VARIANTS.length
    } else if (thing.id === "rope") {
      model.editorRopeVariantIndex[pi] =
        (model.editorRopeVariantIndex[pi] + 1) % EDITOR_ROPE_VARIANTS.length
    } else if (thing.id === "rock") {
      model.editorRockVariantIndex[pi] =
        (model.editorRockVariantIndex[pi] + 1) % EDITOR_ROCK_VARIANTS.length
    } else if (thing.id === "fluid") {
      model.editorFluidIsLava[pi] = !model.editorFluidIsLava[pi]
    } else if (thing.id === "conveyor") {
      model.editorConveyorDirIndex[pi] =
        (model.editorConveyorDirIndex[pi] + 1) % 2
    } else if (thing.id === "hazard") {
      model.editorHazardVariantIndex[pi] =
        (model.editorHazardVariantIndex[pi] + 1) % EDITOR_HAZARD_VARIANTS.length
    } else if (thing.id === "spikes") {
      model.editorSpikeUpsideDown[pi] = !model.editorSpikeUpsideDown[pi]
    } else if (thing.id === "brick") {
      model.editorBrickVariantIndex[pi] =
        (model.editorBrickVariantIndex[pi] + 1) % EDITOR_BRICK_VARIANTS.length
    } else if (thing.id === "coin") {
      model.editorCoinVariantIndex[pi] =
        (model.editorCoinVariantIndex[pi] + 1) % EDITOR_COIN_VARIANTS.length
    }
  }

  const moveEdgeU = Boolean(
    input.editorCursorUp && !model._editorPrevCursorUp[pi],
  )
  const moveEdgeD = Boolean(
    input.editorCursorDown && !model._editorPrevCursorDown[pi],
  )
  const moveEdgeL = Boolean(
    input.editorCursorLeft && !model._editorPrevCursorLeft[pi],
  )
  const moveEdgeR = Boolean(
    input.editorCursorRight && !model._editorPrevCursorRight[pi],
  )

  model._editorPrevCursorUp[pi] = Boolean(input.editorCursorUp)
  model._editorPrevCursorDown[pi] = Boolean(input.editorCursorDown)
  model._editorPrevCursorLeft[pi] = Boolean(input.editorCursorLeft)
  model._editorPrevCursorRight[pi] = Boolean(input.editorCursorRight)

  const lw = getLevelWidth(model)
  const lh = getLevelHeight(model)
  if (moveEdgeU) {
    model.editorTileY[pi] = clamp(model.editorTileY[pi] - 1, 0, lh - 1)
  }
  if (moveEdgeD) {
    model.editorTileY[pi] = clamp(model.editorTileY[pi] + 1, 0, lh - 1)
  }
  if (moveEdgeL) {
    model.editorTileX[pi] = clamp(model.editorTileX[pi] - 1, 0, lw - 1)
  }
  if (moveEdgeR) {
    model.editorTileX[pi] = clamp(model.editorTileX[pi] + 1, 0, lw - 1)
  }

  if (moveEdgeU || moveEdgeD || moveEdgeL || moveEdgeR) {
    model.editorCursorMovedThisFrame[pi] = true
  }

  if (placeEdge) {
    placeSelectedThing(model, pi)
  }
  if (removeEdge) {
    removeAtCursor(model, pi)
  }
  if (undoEdge) {
    undoLastEditAndReload(model)
    return
  }
}

/**
 * World-space center of editor cursor tile(s) (for camera).
 *
 * @param {import('./game-state.js').GameModel} model
 * @returns {{ x: number, y: number }}
 */
export function getEditorFocusWorld(model) {
  const count = Math.min(model.players.length, 2)
  let ex = 0
  let ey = 0
  let n = 0
  let mx = 0
  let my = 0
  let nm = 0
  for (let i = 0; i < count; i++) {
    const cx = (model.editorTileX[i] + 0.5) * TILE_SIZE
    const cy = (model.editorTileY[i] + 0.5) * TILE_SIZE
    ex += cx
    ey += cy
    n++
    if (model.editorCursorMovedThisFrame[i]) {
      mx += cx
      my += cy
      nm++
    }
  }

  if (n === 0) {
    return {
      x: model.world.width / 2,
      y: model.world.height / 2,
    }
  }

  if (nm > 0) {
    return { x: mx / nm, y: my / nm }
  }
  return { x: ex / n, y: ey / n }
}

/**
 * @param {import('./game-state.js').GameModel} model
 * @param {number} pi
 */
function placeSelectedThing(model, pi) {
  const level = model.levels[0]
  if (!level) return
  const thing = EDITOR_PLACEABLES[model.editorThingIndex[pi]]
  if (!thing) return

  const tx = model.editorTileX[pi]
  const ty = model.editorTileY[pi]

  if (thing.id === "fluid") {
    ensureTerrainVariant(level)
    const lava = model.editorFluidIsLava[pi]
    floodFluidPlaceDown(level, tx, ty, lava)
    appendEditLog(model, {
      op: lava ? "lavaPlace" : "waterPlace",
      x: tx,
      y: ty,
    })
    model.terrainRevision += 1
    return
  }

  if (thing.id === "terrain") {
    toggleTerrainAtCursor(model, pi)
    return
  }

  removeThingAtCursor(model, pi)

  const c = thingHasColors(thing)
    ? getEditorColorForPlaceable(model, thing.id, pi)
    : EDITOR_COLORS[model.editorColorIndex[pi]] ?? "blue"

  if (thing.id === "ladder") {
    if (ty - (LADDER_PLACE_HEIGHT - 1) < 0) return
    mergeLadderPlacement(level, tx, ty)
    appendEditLog(model, { op: "ladderPlace", x: tx, y: ty })
    return
  }

  if (thing.id === "gem") {
    pushObjectAndLog(model, {
      kind: "gem",
      x: tx,
      y: ty,
      width: 1,
      height: 1,
      sprite: `gem_${c}`,
      collected: false,
    })
    return
  }

  if (thing.id === "coin") {
    const cv =
      EDITOR_COIN_VARIANTS[model.editorCoinVariantIndex[pi] ?? 0] ??
      EDITOR_COIN_VARIANTS[0]
    pushObjectAndLog(model, {
      kind: "coin",
      x: tx,
      y: ty,
      width: 1,
      height: 1,
      sprite: cv.sprite,
      collected: false,
    })
    return
  }

  if (thing.id === "key") {
    pushObjectAndLog(model, {
      kind: "key",
      x: tx,
      y: ty,
      width: 1,
      height: 1,
      sprite: `key_${c}`,
      collected: false,
    })
    return
  }

  if (thing.id === "color_block") {
    pushObjectAndLog(model, {
      kind: "color_block",
      x: tx,
      y: ty,
      width: 1,
      height: 1,
      solid: true,
      sprite: `block_${c}`,
      collected: false,
    })
    return
  }

  if (thing.id === "spikes") {
    pushObjectAndLog(model, {
      kind: "spikes",
      x: tx,
      y: ty,
      width: 1,
      height: 1,
      sprite: "block_spikes",
      collected: false,
      upsideDown: model.editorSpikeUpsideDown[pi] === true,
    })
    return
  }

  if (thing.id === "lock") {
    const bottomY = ty
    if (bottomY < 0) return
    pushObjectAndLog(model, {
      kind: "lock",
      x: tx,
      y: bottomY,
      width: 1,
      height: EDITOR_LOCK_HEIGHT_TILES,
      solid: true,
      sprite: `lock_${c}`,
      collected: false,
    })
    return
  }

  if (thing.id === "exit_door") {
    const bottomY = ty
    const topY = bottomY - (EXIT_DOOR_HEIGHT_TILES - 1)
    if (topY < 0) return
    pushObjectAndLog(model, {
      kind: "exit_door",
      x: tx,
      y: bottomY,
      width: 1,
      height: EXIT_DOOR_HEIGHT_TILES,
      solid: true,
      sprite: "exit_door",
      collected: false,
    })
    return
  }

  if (thing.id === "spring") {
    pushObjectAndLog(model, {
      kind: "spring",
      x: tx,
      y: ty,
      width: 1,
      height: 1,
      sprite: "spring",
      collected: false,
      solid: false,
    })
    return
  }

  if (thing.id === "flag") {
    pushObjectAndLog(model, {
      kind: "flag",
      x: tx,
      y: ty,
      width: 1,
      height: 1,
      sprite: `flag_${c}_a`,
      collected: false,
      solid: false,
    })
    return
  }

  if (thing.id === "conveyor") {
    const left = model.editorConveyorDirIndex[pi] === 1
    pushObjectAndLog(model, {
      kind: "conveyor",
      x: tx,
      y: ty,
      width: 1,
      height: 1,
      sprite: "conveyor",
      state: left ? "-1" : "1",
      collected: false,
      solid: true,
    })
    return
  }

  if (thing.id === "hazard") {
    const v =
      EDITOR_HAZARD_VARIANTS[model.editorHazardVariantIndex[pi] ?? 0] ??
      EDITOR_HAZARD_VARIANTS[0]
    if (!v) return
    const obj = {
      kind: v.kind,
      x: tx,
      y: ty,
      width: 1,
      height: 1,
      sprite: v.sprite,
      collected: false,
      solid: false,
    }
    if (v.state !== undefined) obj.state = v.state
    pushObjectAndLog(model, obj)
    return
  }

  if (thing.id === "brick") {
    const v =
      EDITOR_BRICK_VARIANTS[model.editorBrickVariantIndex[pi] ?? 0] ??
      EDITOR_BRICK_VARIANTS[0]
    if (!v) return
    pushObjectAndLog(model, {
      kind: v.kind,
      x: tx,
      y: ty,
      width: 1,
      height: 1,
      sprite: v.sprite,
      solid: v.solid !== false,
      collected: false,
    })
    return
  }

  if (thing.id === "bomb") {
    pushObjectAndLog(model, {
      kind: "bomb",
      x: tx,
      y: ty,
      width: 1,
      height: 1,
      sprite: "bomb",
      solid: false,
      collected: false,
    })
    return
  }

  if (thing.id === "switch") {
    pushObjectAndLog(model, {
      kind: "switch",
      x: tx,
      y: ty,
      width: 1,
      height: 1,
      sprite: `switch_${c}`,
      collected: false,
      solid: false,
    })
    return
  }

  if (thing.id === "bridge") {
    const v =
      EDITOR_BRIDGE_VARIANTS[model.editorBridgeVariantIndex[pi] ?? 0] ??
      EDITOR_BRIDGE_VARIANTS[0]
    if (!v) return
    pushObjectAndLog(model, {
      kind: v.kind,
      x: tx,
      y: ty,
      width: 1,
      height: 1,
      sprite: v.sprite,
      solid: v.solid,
      collected: false,
    })
    return
  }

  if (thing.id === "torch") {
    pushObjectAndLog(model, {
      kind: "torch",
      x: tx,
      y: ty,
      width: 1,
      height: 1,
      sprite: "torch_on_a",
      solid: false,
      collected: false,
    })
    return
  }

  if (thing.id === "rope") {
    const v =
      EDITOR_ROPE_VARIANTS[model.editorRopeVariantIndex[pi] ?? 0] ??
      EDITOR_ROPE_VARIANTS[0]
    if (!v) return
    pushObjectAndLog(model, {
      kind: v.kind,
      x: tx,
      y: ty,
      width: 1,
      height: 1,
      sprite: v.sprite,
      solid: v.solid,
      collected: false,
    })
    return
  }

  if (thing.id === "rock") {
    const v =
      EDITOR_ROCK_VARIANTS[model.editorRockVariantIndex[pi] ?? 0] ??
      EDITOR_ROCK_VARIANTS[0]
    if (!v) return
    pushObjectAndLog(model, {
      kind: v.kind,
      x: tx,
      y: ty,
      width: 1,
      height: 1,
      sprite: v.sprite,
      solid: v.solid,
      collected: false,
    })
    return
  }

  if (thing.id === "special_block") {
    const variant =
      EDITOR_BLOCK_VARIANTS[model.editorBlockVariantIndex[pi]] ??
      EDITOR_BLOCK_VARIANTS[0]
    if (!variant) return
    pushObjectAndLog(model, {
      kind: variant.kind,
      x: tx,
      y: ty,
      width: 1,
      height: 1,
      sprite: variant.sprite,
      solid: true,
      collected: false,
    })
    return
  }
}

/**
 * @param {import('./game-state.js').GameModel} model
 * @param {number} pi
 */
function toggleTerrainAtCursor(model, pi) {
  const level = model.levels[0]
  if (!level?.layers.terrain) return
  ensureTerrainVariant(level)

  const x = model.editorTileX[pi]
  const y = model.editorTileY[pi]
  const rows = level.layers.terrain
  if (y < 0 || y >= rows.length) return
  const row = rows[y] ?? ""
  if (x < 0 || x >= row.length) return
  const ch = row[x]
  if (ch !== "1" && ch !== "0") return

  const biome =
    TERRAIN_BIOMES[model.editorBiomeIndex[pi]] ?? TERRAIN_BIOMES[0] ?? "grass"
  const biomeChar = biomeToChar(biome)

  if (!applyTerrainToggle(level, x, y, biomeChar)) return
  appendEditLog(model, { op: "terrainToggle", x, y, biomeChar })
  model.terrainRevision += 1
}

/**
 * Remove one object covering cursor, else clear terrain cell to air.
 *
 * @param {import('./game-state.js').GameModel} model
 * @param {number} pi
 */
function removeAtCursor(model, pi) {
  const thing = EDITOR_PLACEABLES[model.editorThingIndex[pi]]
  if (thing?.id === "fluid") {
    const level = model.levels[0]
    if (!level) return
    ensureTerrainVariant(level)
    const fx = model.editorTileX[pi]
    const fy = model.editorTileY[pi]
    const lava = model.editorFluidIsLava[pi]
    floodFluidRemoveUp(level, fx, fy)
    appendEditLog(model, {
      op: lava ? "lavaRemove" : "waterRemove",
      x: fx,
      y: fy,
    })
    model.terrainRevision += 1
    return
  }
  if (removeThingAtCursor(model, pi)) {
    return
  }
  clearTerrainAtCursor(model, pi)
}

/**
 * @param {import('./game-state.js').GameModel} model
 * @param {number} pi
 * @returns {boolean} True if an object was removed
 */
function removeThingAtCursor(model, pi) {
  const level = model.levels[0]
  if (!level) return false
  const tx = model.editorTileX[pi]
  const ty = model.editorTileY[pi]
  if (removeLadderSegmentAtTile(level, tx, ty)) {
    appendEditLog(model, { op: "objectRemoveTile", tx, ty })
    return true
  }
  const idx = level.objects.findIndex((o) => objectCoversTile(o, tx, ty))
  if (idx >= 0) {
    appendEditLog(model, { op: "objectRemoveTile", tx, ty })
    level.objects.splice(idx, 1)
    return true
  }
  return false
}

/**
 * @param {import('./game-state.js').GameModel} model
 * @param {number} pi
 */
function clearTerrainAtCursor(model, pi) {
  const level = model.levels[0]
  if (!level?.layers.terrain) return
  ensureTerrainVariant(level)
  const x = model.editorTileX[pi]
  const y = model.editorTileY[pi]
  if (clearTerrainCell(level, x, y)) {
    appendEditLog(model, { op: "terrainClear", x, y })
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
