// @ts-nocheck
import { ensureTerrainVariant } from "./terrain-biome.js"

/**
 * Paint all solid cells 4-connected to (sx,sy) with the same biome char.
 *
 * @param {GameLevel} level
 * @param {number} sx
 * @param {number} sy
 * @param {string} biomeChar
 */
export function floodFillSolidTerrainVariant(level, sx, sy, biomeChar) {
  const terrain = level.layers.terrain
  const variant = level.layers.terrainVariant
  if (!variant || terrain.length === 0) return

  const h = terrain.length
  /** @type {{ x: number, y: number }[]} */
  const stack = [{ x: sx, y: sy }]
  const seen = new Set()

  while (stack.length > 0) {
    const next = stack.pop()
    if (!next) continue
    const { x, y } = next
    if (y < 0 || y >= h) continue
    const tr = terrain[y] ?? ""
    const rowW = tr.length
    if (x < 0 || x >= rowW) continue
    const k = `${x},${y}`
    if (seen.has(k)) continue
    if (tr[x] !== "1") continue
    seen.add(k)

    let vr = (variant[y] ?? "").split("")
    if (vr.length < rowW) {
      vr = (variant[y] ?? "").padEnd(rowW, " ").split("")
    }
    vr[x] = biomeChar
    variant[y] = vr.join("").slice(0, rowW)

    if (x + 1 < rowW) stack.push({ x: x + 1, y })
    if (x - 1 >= 0) stack.push({ x: x - 1, y })
    stack.push({ x, y: y + 1 })
    stack.push({ x, y: y - 1 })
  }
}

/**
 * Set biome variant on a single solid cell (no 4-connected flood).
 *
 * @param {GameLevel} level
 * @param {number} x
 * @param {number} y
 * @param {string} biomeChar
 */
export function setTerrainCellVariantOnly(level, x, y, biomeChar) {
  ensureTerrainVariant(level)
  const rows = level.layers.terrain
  const variants = level.layers.terrainVariant
  if (!variants || y < 0 || y >= rows.length) return
  const rowW = (rows[y] ?? "").length
  if (x < 0 || x >= rowW) return
  let vr = (variants[y] ?? "").split("")
  if (vr.length < rowW) {
    vr = (variants[y] ?? "").padEnd(rowW, " ").split("")
  }
  vr[x] = biomeChar
  variants[y] = vr.join("").slice(0, rowW)
}

/**
 * Same behavior as editor terrain tool at (x,y) with given biome char.
 * When `flood` is false, only this cell's variant is set; when true,
 * solid terrain is flood-filled like the Terrain tool (grass/sand/etc.).
 *
 * @param {GameLevel} level
 * @param {number} x
 * @param {number} y
 * @param {string} biomeChar
 * @param {{ flood?: boolean }} [options]
 */
export function applyTerrainToggle(level, x, y, biomeChar, options) {
  if (!level?.layers.terrain) return false
  ensureTerrainVariant(level)
  const rows = level.layers.terrain
  const variants = level.layers.terrainVariant
  if (!variants) return false
  if (y < 0 || y >= rows.length) return false
  const row = rows[y] ?? ""
  if (x < 0 || x >= row.length) return false
  const chars = row.split("")
  const ch = chars[x]
  if (ch !== "1" && ch !== "0") return false

  const flood = options?.flood !== false

  if (!flood) {
    if (ch === "0") {
      chars[x] = "1"
      rows[y] = chars.join("")
    }
    setTerrainCellVariantOnly(level, x, y, biomeChar)
    return true
  }

  if (ch === "0") {
    chars[x] = "1"
    rows[y] = chars.join("")
    floodFillSolidTerrainVariant(level, x, y, biomeChar)
  } else {
    floodFillSolidTerrainVariant(level, x, y, biomeChar)
  }
  return true
}

/**
 * Clear solid terrain at (x,y) to air (editor remove on empty cell).
 *
 * @param {GameLevel} level
 * @param {number} x
 * @param {number} y
 */
export function clearTerrainCell(level, x, y) {
  if (!level?.layers.terrain) return false
  ensureTerrainVariant(level)
  const rows = level.layers.terrain
  const variant = level.layers.terrainVariant
  if (!variant) return false
  if (y < 0 || y >= rows.length) return false
  const row = rows[y] ?? ""
  if (x < 0 || x >= row.length) return false
  const chars = row.split("")
  if (chars[x] === "1") {
    chars[x] = "0"
    rows[y] = chars.join("")
    const vr = (variant[y] ?? "").split("")
    if (vr[x] !== undefined) vr[x] = " "
    variant[y] = vr.join("")
    return true
  }
  return false
}
