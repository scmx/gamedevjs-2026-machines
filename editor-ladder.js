/** Initial ladder height when placing (cells). */
export const LADDER_PLACE_HEIGHT = 3
/** Minimum ladder segment height after splits / removals. */
export const LADDER_MIN_SEGMENT = 2

/**
 * @param {GameLevelObject} object
 * @param {number} tx
 * @param {number} ty
 * @returns {boolean}
 */
export function ladderCoversTile(object, tx, ty) {
  if (object.kind !== "ladder") return false
  const left = object.x
  const right = object.x + object.width - 1
  const top = object.y - object.height + 1
  const bottom = object.y
  return tx >= left && tx <= right && ty >= top && ty <= bottom
}

/**
 * Place or extend a vertical ladder at (tx, ty): new run is {@link LADDER_PLACE_HEIGHT} cells tall,
 * bottom at ty. Merges with existing ladders on the same column when adjacent or overlapping.
 *
 * @param {GameLevel} level
 * @param {number} tx
 * @param {number} ty
 * @returns {GameLevelObject | undefined} The merged ladder object
 */
export function mergeLadderPlacement(level, tx, ty) {
  const segTop = ty - (LADDER_PLACE_HEIGHT - 1)
  const segBottom = ty
  const ladders = level.objects.filter(
    (o) => o.kind === "ladder" && o.x === tx && !o.collected,
  )

  let top = segTop
  let bottom = segBottom
  /** @type {Set<GameLevelObject>} */
  const used = new Set()
  let changed = true
  while (changed) {
    changed = false
    for (const L of ladders) {
      if (used.has(L)) continue
      const lt = L.y - L.height + 1
      const lb = L.y
      if (lb >= top - 1 && lt <= bottom + 1) {
        used.add(L)
        top = Math.min(top, lt)
        bottom = Math.max(bottom, lb)
        changed = true
      }
    }
  }

  level.objects = level.objects.filter(
    (o) => !(o.kind === "ladder" && o.x === tx && !o.collected),
  )

  const height = bottom - top + 1
  const ladder = {
    kind: "ladder",
    x: tx,
    y: bottom,
    width: 1,
    height,
    sprite: "ladder",
    collected: false,
    solid: false,
  }
  level.objects.push(ladder)
  return ladder
}

/**
 * Remove one cell from a ladder column, splitting or deleting segments shorter than
 * {@link LADDER_MIN_SEGMENT}.
 *
 * @param {GameLevel} level
 * @param {number} tx
 * @param {number} ty
 * @returns {boolean}
 */
export function removeLadderSegmentAtTile(level, tx, ty) {
  const idx = level.objects.findIndex((o) => ladderCoversTile(o, tx, ty))
  if (idx < 0) return false
  const L = level.objects[idx]
  if (!L || L.kind !== "ladder") return false

  const lt = L.y - L.height + 1
  const lb = L.y
  level.objects.splice(idx, 1)

  const upperRows = ty - lt
  const lowerRows = lb - ty
  if (upperRows >= LADDER_MIN_SEGMENT) {
    level.objects.push({
      kind: "ladder",
      x: L.x,
      y: ty - 1,
      width: 1,
      height: upperRows,
      sprite: "ladder",
      collected: false,
      solid: false,
    })
  }
  if (lowerRows >= LADDER_MIN_SEGMENT) {
    level.objects.push({
      kind: "ladder",
      x: L.x,
      y: lb,
      width: 1,
      height: lowerRows,
      sprite: "ladder",
      collected: false,
      solid: false,
    })
  }
  return true
}
