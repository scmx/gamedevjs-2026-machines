// @ts-nocheck
import {
  mergeLadderPlacement,
  removeLadderSegmentAtTile,
} from "./editor-ladder.js"
import {
  applyTerrainToggle,
  clearTerrainCell,
} from "./editor-terrain-ops.js"
import {
  floodFluidPlaceDown,
  floodFluidRemoveUp,
} from "./terrain-fluid.js"
import { ensureTerrainVariant } from "./terrain-biome.js"

/** @type {number} */
export const EDIT_LOG_FORMAT_VERSION = 1

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
 * @param {unknown} obj
 * @returns {GameLevelObject}
 */
function cloneObject(obj) {
  return /** @type {GameLevelObject} */ (
    JSON.parse(JSON.stringify(obj))
  )
}

/**
 * @param {import('./game-state.js').GameModel} model
 * @param {EditLogOp} op
 */
export function appendEditLog(model, op) {
  if (!model.editLog) model.editLog = []
  model.editLog.push(op)
  const level = model.levels[0]
  if (level) {
    if (!level.generatedFrom.ops) level.generatedFrom.ops = []
    level.generatedFrom.ops.push(op)
  }
  model.onProjectDirty?.()
}

/**
 * Replay editor operations on a freshly generated level (same seed as when editing started).
 *
 * @param {GameLevel} level
 * @param {EditLogOp[]} ops
 * @param {import('./game-state.js').GameModel} [model] If set, bumps terrainRevision when terrain/fluids change.
 */
export function applyEditInstructions(level, ops, model) {
  if (!level) return
  ensureTerrainVariant(level)
  for (const op of ops) {
    switch (op.op) {
      case "waterPlace":
        floodFluidPlaceDown(level, op.x, op.y, false)
        if (model) model.terrainRevision += 1
        break
      case "lavaPlace":
        floodFluidPlaceDown(level, op.x, op.y, true)
        if (model) model.terrainRevision += 1
        break
      case "waterRemove":
        floodFluidRemoveUp(level, op.x, op.y)
        if (model) model.terrainRevision += 1
        break
      case "lavaRemove":
        floodFluidRemoveUp(level, op.x, op.y)
        if (model) model.terrainRevision += 1
        break
      case "terrainToggle": {
        const flood =
          op.flood !== undefined ? op.flood : op.biomeChar !== "h"
        applyTerrainToggle(level, op.x, op.y, op.biomeChar, { flood })
        if (model) model.terrainRevision += 1
        break
      }
      case "terrainClear":
        clearTerrainCell(level, op.x, op.y)
        if (model) model.terrainRevision += 1
        break
      case "objectAdd": {
        const o = cloneObject(op.obj)
        level.objects.push(o)
        break
      }
      case "ladderPlace":
        mergeLadderPlacement(level, op.x, op.y)
        break
      case "objectRemoveTile": {
        if (removeLadderSegmentAtTile(level, op.tx, op.ty)) break
        const idx = level.objects.findIndex((o) =>
          objectCoversTile(o, op.tx, op.ty),
        )
        if (idx >= 0) level.objects.splice(idx, 1)
        break
      }
      default:
        break
    }
  }
}

/**
 * @param {import('./game-state.js').GameModel} model
 * @param {number} levelVersion From {@link generateLevel} metadata.
 * @returns {string}
 */
export function exportEditLogJson(model, levelVersion) {
  const payload = {
    v: EDIT_LOG_FORMAT_VERSION,
    levels: model.levels.map((level) => ({
      seed: level.generatedFrom?.seed ?? 0,
      levelVersion: level.generatedFrom?.version ?? levelVersion ?? 1,
      music: level.generatedFrom?.music,
      ops: level.generatedFrom?.ops ?? [],
    })),
  }
  return JSON.stringify(payload, null, 2)
}

/**
 * @typedef {{
 *   op: "waterPlace"
 *   x: number
 *   y: number
 * }} WaterPlaceOp
 * @typedef {{
 *   op: "lavaPlace"
 *   x: number
 *   y: number
 * }} LavaPlaceOp
 * @typedef {{
 *   op: "waterRemove"
 *   x: number
 *   y: number
 * }} WaterRemoveOp
 * @typedef {{
 *   op: "lavaRemove"
 *   x: number
 *   y: number
 * }} LavaRemoveOp
 * @typedef {{
 *   op: "terrainToggle"
 *   x: number
 *   y: number
 *   biomeChar: string
 *   flood?: boolean
 * }} TerrainToggleOp
 * @typedef {{
 *   op: "terrainClear"
 *   x: number
 *   y: number
 * }} TerrainClearOp
 * @typedef {{
 *   op: "objectAdd"
 *   obj: GameLevelObject
 * }} ObjectAddOp
 * @typedef {{
 *   op: "objectRemoveTile"
 *   tx: number
 *   ty: number
 * }} ObjectRemoveTileOp
 * @typedef {{
 *   op: "ladderPlace"
 *   x: number
 *   y: number
 * }} LadderPlaceOp
 * @typedef {
 *   | WaterPlaceOp
 *   | LavaPlaceOp
 *   | WaterRemoveOp
 *   | LavaRemoveOp
 *   | TerrainToggleOp
 *   | TerrainClearOp
 *   | ObjectAddOp
 *   | ObjectRemoveTileOp
 *   | LadderPlaceOp
 * } EditLogOp
 */
