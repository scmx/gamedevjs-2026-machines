export const FLUID_WATER = "W"
export const FLUID_LAVA = "Y"

/**
 * @param {string} ch
 * @returns {boolean}
 */
export function isFluidChar(ch) {
  return ch === FLUID_WATER || ch === FLUID_LAVA
}

/**
 * @param {string} ch
 * @returns {"water" | "lava" | null}
 */
export function fluidKindFromChar(ch) {
  if (ch === FLUID_WATER) return "water"
  if (ch === FLUID_LAVA) return "lava"
  return null
}

/**
 * @param {GameLevel} level
 * @param {number} tx
 * @param {number} ty
 * @returns {"water" | "lava" | null}
 */
export function getFluidAtTile(level, tx, ty) {
  const rows = level.layers.terrain
  const vr = level.layers.terrainVariant
  if (!rows || !vr) return null
  const row = rows[ty]
  if (!row || ty < 0 || ty >= rows.length) return null
  if (tx < 0 || tx >= row.length) return null
  if (row[tx] !== "0") return null
  const ch = vr[ty]?.[tx] ?? " "
  return fluidKindFromChar(ch)
}

/**
 * Flood-fill fluid on air tiles: cursor row and all rows below (higher tileY).
 *
 * @param {GameLevel} level
 * @param {number} sx
 * @param {number} sy
 * @param {boolean} isLava
 */
export function floodFluidPlaceDown(level, sx, sy, isLava) {
  const rows = level.layers.terrain
  const variants = level.layers.terrainVariant
  if (!variants || !rows.length) return
  if (sy < 0 || sy >= rows.length) return
  const row0 = rows[sy] ?? ""
  if (sx < 0 || sx >= row0.length) return
  if (row0[sx] !== "0") return

  const fluidCh = isLava ? FLUID_LAVA : FLUID_WATER
  const minRowY = sy
  /** @type {{ x: number, y: number }[]} */
  const stack = [{ x: sx, y: sy }]
  const seen = new Set()

  while (stack.length > 0) {
    const next = stack.pop()
    if (!next) continue
    const { x, y } = next
    if (y < minRowY || y >= rows.length) continue
    const tr = rows[y] ?? ""
    if (x < 0 || x >= tr.length) continue
    if (tr[x] !== "0") continue
    const k = `${x},${y}`
    if (seen.has(k)) continue
    seen.add(k)

    let vr = (variants[y] ?? "").split("")
    if (vr.length < tr.length) {
      vr = (variants[y] ?? "").padEnd(tr.length, " ").split("")
    }
    vr[x] = fluidCh
    variants[y] = vr.join("").slice(0, tr.length)

    const dirs = [
      { x: x - 1, y },
      { x: x + 1, y },
      { x, y: y + 1 },
    ]
    if (y > minRowY) dirs.push({ x, y: y - 1 })
    for (const d of dirs) {
      stack.push(d)
    }
  }
}

/**
 * Remove fluid from connected air cells on cursor row and above (lower tileY).
 *
 * @param {GameLevel} level
 * @param {number} sx
 * @param {number} sy
 */
export function floodFluidRemoveUp(level, sx, sy) {
  const rows = level.layers.terrain
  const variants = level.layers.terrainVariant
  if (!variants || !rows.length) return
  if (sy < 0 || sy >= rows.length) return
  const row0 = rows[sy] ?? ""
  if (sx < 0 || sx >= row0.length) return
  const startCh = variants[sy]?.[sx] ?? " "
  if (!isFluidChar(startCh)) return

  const maxRowY = sy
  /** @type {{ x: number, y: number }[]} */
  const stack = [{ x: sx, y: sy }]
  const seen = new Set()

  while (stack.length > 0) {
    const next = stack.pop()
    if (!next) continue
    const { x, y } = next
    if (y < 0 || y > maxRowY) continue
    const tr = rows[y] ?? ""
    if (x < 0 || x >= tr.length) continue
    if (tr[x] !== "0") continue
    const k = `${x},${y}`
    if (seen.has(k)) continue
    const vch = variants[y]?.[x] ?? " "
    if (!isFluidChar(vch)) continue
    seen.add(k)

    let vr = (variants[y] ?? "").split("")
    if (vr.length < tr.length) {
      vr = (variants[y] ?? "").padEnd(tr.length, " ").split("")
    }
    vr[x] = " "
    variants[y] = vr.join("").slice(0, tr.length)

    const dirs = [
      { x: x - 1, y },
      { x: x + 1, y },
      { x, y: y - 1 },
    ]
    if (y < maxRowY) dirs.push({ x, y: y + 1 })
    for (const d of dirs) {
      stack.push(d)
    }
  }
}
