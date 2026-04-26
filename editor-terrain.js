import { EDITOR_BLOCK_VARIANTS } from "./editor-block-variants.js"
import { EDITOR_BRICK_VARIANTS } from "./editor-brick-variants.js"
import { EDITOR_COIN_VARIANTS } from "./editor-coin-variants.js"
import { INTERACTIVE_BLOCK_KINDS } from "./game-entities.js"
import { biomeFromSeed, biomeToChar, musicModeForBiome } from "./terrain-biome.js"

/** Pre-release generation stamp; keep at 1 until versioned branches are needed. */
export const LEVEL_VERSION = 1
const LEVEL_WIDTH = 48
/** Taller level for sky islands, deep valleys, and full-height edge walls. */
const LEVEL_HEIGHT = 22

/**
 * @param {number} [seed]
 * @returns {GameLevel}
 */
export function generateLevel(seed = randomLevelSeed()) {
  const { terrain, terrainVariant } = buildTerrainRows(seed)
  const rng = createRng((seed ^ 0x9e3779b9) >>> 0)
  const occupiedTiles = new Set()
  const objects = [
    ...buildGemObjects(terrain, occupiedTiles),
    ...buildCoinObjects(terrain, occupiedTiles, rng),
    ...buildKeyObjects(terrain, occupiedTiles),
    ...buildLockObjects(terrain, occupiedTiles),
  ]
  const exitDoor = buildExitDoor(terrain, occupiedTiles)
  if (exitDoor) {
    objects.push(exitDoor)
  }
  objects.push(
    ...buildBridgeTorchObjects(terrain, occupiedTiles, rng),
    ...buildHazardObjects(terrain, occupiedTiles, rng),
    ...buildInteractiveBlockObjects(terrain, occupiedTiles, rng),
    ...buildSwitchObjects(terrain, occupiedTiles, objects, rng),
  )

  return {
    id: `generated-${seed}`,
    name: "Generated Test Level",
    width: LEVEL_WIDTH,
    height: LEVEL_HEIGHT,
    layers: {
      terrain,
      terrainVariant,
    },
    objects,
    generatedFrom: {
      version: LEVEL_VERSION,
      seed,
      music: musicModeForBiome(biomeFromSeed(seed)),
      ops: [],
    },
  }
}

/** @returns {number} */
export function randomLevelSeed() {
  return Math.floor(Math.random() * 1_000_000_000)
}

/**
 * @param {number} seed
 * @returns {{ terrain: string[], mainSurfaceY: number[], terrainVariant: string[] }}
 */
function buildTerrainRows(seed) {
  const rng = createRng(seed)
  const h = LEVEL_HEIGHT
  const w = LEVEL_WIDTH

  /** @type {boolean[][]} */
  const solid = Array.from({ length: h }, () => Array(w).fill(false))
  /** @type {number[]} Top solid row index per column for main ground (before islands). */
  const mainSurfaceY = []

  for (let y = 0; y < h; y++) {
    const row = solid[y]
    if (!row) continue
    row[0] = true
    row[w - 1] = true
  }

  for (let y = h - 2; y < h; y++) {
    const row = solid[y]
    if (!row) continue
    for (let x = 0; x < w; x++) {
      row[x] = true
    }
  }

  const minWalk = 5
  const maxWalk = h - 8
  let walk = Math.floor(minWalk + rng() * (maxWalk - minWalk + 1))

  for (let x = 1; x < w - 1; x++) {
    if (x > 2 && x < w - 3) {
      const roll = rng()
      if (roll < 0.26) {
        walk += rng() < 0.52 ? -1 : 1
      } else if (roll < 0.42) {
        walk += rng() < 0.5 ? -2 : 2
      }
    }
    walk = clamp(walk, minWalk, maxWalk)
    mainSurfaceY[x] = walk

    for (let y = walk; y < h - 2; y++) {
      const row = solid[y]
      if (row) row[x] = true
    }
  }

  mainSurfaceY[0] = mainSurfaceY[1] ?? minWalk
  mainSurfaceY[w - 1] = mainSurfaceY[w - 2] ?? minWalk

  const islandAttempts = 6 + Math.floor(rng() * 7)
  for (let i = 0; i < islandAttempts; i++) {
    const islandW = 3 + Math.floor(rng() * 6)
    const islandH = 2 + Math.floor(rng() * 2)
    const maxLeft = w - 2 - islandW
    if (maxLeft < 4) continue
    const leftEdge = 3 + Math.floor(rng() * (maxLeft - 2))
    const cx = leftEdge + Math.floor(islandW / 2)
    const groundTop = mainSurfaceY[cx] ?? minWalk
    const clearance = 3 + Math.floor(rng() * 2)
    const maxTopY = Math.max(1, groundTop - islandH - clearance)
    const topY = 1 + Math.floor(rng() * maxTopY)

    let ok = true
    for (let dx = 0; dx < islandW && ok; dx++) {
      const x = cx - Math.floor(islandW / 2) + dx
      if (x < 2 || x >= w - 2) {
        ok = false
        break
      }
      const g = mainSurfaceY[x] ?? groundTop
      if (topY + islandH > g - clearance + 1) ok = false
    }
    if (!ok) continue

    for (let dx = 0; dx < islandW; dx++) {
      const x = cx - Math.floor(islandW / 2) + dx
      if (x < 2 || x >= w - 2) continue
      for (let dy = 0; dy < islandH; dy++) {
        const y = topY + dy
        if (y >= 1 && y < h - 2) {
          const row = solid[y]
          if (row) row[x] = true
        }
      }
    }
  }

  thickenEdgeWalls(solid, h, w)

  /** @type {string[]} */
  const rows = []
  for (let y = 0; y < h; y++) {
    let rowStr = ""
    const solidRow = solid[y]
    for (let x = 0; x < w; x++) {
      rowStr += solidRow?.[x] ? "1" : "0"
    }
    rows.push(rowStr)
  }

  const biome = biomeFromSeed(seed)
  const vch = biomeToChar(biome)
  /** @type {string[]} */
  const variantRows = []
  for (const row of rows) {
    let vr = ""
    for (let i = 0; i < row.length; i++) {
      vr += row[i] === "1" ? vch : " "
    }
    variantRows.push(vr)
  }

  return { terrain: rows, mainSurfaceY, terrainVariant: variantRows }
}

/**
 * Second column of wall tiles for chunkier cliff faces at both edges.
 *
 * @param {boolean[][]} solid
 * @param {number} h
 * @param {number} w
 */
function thickenEdgeWalls(solid, h, w) {
  for (let y = 0; y < h; y++) {
    const row = solid[y]
    if (!row) continue
    row[1] = true
    row[w - 2] = true
  }
}

/**
 * @param {string[]} terrainRows
 * @param {Set<string>} occupiedTiles
 * @returns {GameLevelObject[]}
 */
function buildGemObjects(terrainRows, occupiedTiles) {
  /** @type {GameLevelObject[]} */
  const objects = []

  for (let x = 3; x < LEVEL_WIDTH - 3; x += 5) {
    const standY = getTopStandTileY(terrainRows, x)
    if (standY == null) continue
    const tileKey = `${x},${standY}`
    if (occupiedTiles.has(tileKey)) continue

    objects.push({
      kind: "gem",
      x,
      y: standY,
      width: 1,
      height: 1,
      sprite: getGemSprite(objects.length),
      collected: false,
    })
    occupiedTiles.add(tileKey)
  }

  return objects
}

/**
 * @param {string[]} terrainRows
 * @param {Set<string>} occupiedTiles
 * @param {() => number} rng
 * @returns {GameLevelObject[]}
 */
function buildCoinObjects(terrainRows, occupiedTiles, rng) {
  /** @type {GameLevelObject[]} */
  const objects = []

  for (let x = 5; x < LEVEL_WIDTH - 5; x += 7) {
    const standY = getTopStandTileY(terrainRows, x)
    if (standY == null) continue
    const tileKey = `${x},${standY}`
    if (occupiedTiles.has(tileKey)) continue

    const n = EDITOR_COIN_VARIANTS.length
    const coinSprite =
      EDITOR_COIN_VARIANTS[Math.floor(rng() * n)]?.sprite ?? "coin_gold"

    objects.push({
      kind: "coin",
      x,
      y: standY,
      width: 1,
      height: 1,
      sprite: coinSprite,
      collected: false,
    })
    occupiedTiles.add(tileKey)
  }

  return objects
}

/**
 * @param {string[]} terrainRows
 * @param {Set<string>} occupiedTiles
 * @returns {GameLevelObject[]}
 */
function buildKeyObjects(terrainRows, occupiedTiles) {
  const keyColors = ["blue", "green", "red", "yellow"]
  /** @type {GameLevelObject[]} */
  const objects = []

  for (let index = 0; index < keyColors.length; index++) {
    const color = keyColors[index]
    if (!color) continue
    let x = 8 + index * 10
    let y = /** @type {number | null} */ (null)

    while (x < LEVEL_WIDTH - 2) {
      y = getTopStandTileY(terrainRows, x)
      if (y != null && !occupiedTiles.has(`${x},${y}`)) break
      x += 1
    }

    if (y == null || occupiedTiles.has(`${x},${y}`)) continue

    objects.push({
      kind: "key",
      x,
      y,
      width: 1,
      height: 1,
      sprite: `key_${color}`,
      collected: false,
    })
    occupiedTiles.add(`${x},${y}`)
  }

  return objects
}

/**
 * @param {string[]} terrainRows
 * @param {Set<string>} occupiedTiles
 * @returns {GameLevelObject[]}
 */
function buildLockObjects(terrainRows, occupiedTiles) {
  const keyColors = ["blue", "green", "red", "yellow"]
  /** @type {GameLevelObject[]} */
  const objects = []

  for (let index = 0; index < keyColors.length; index++) {
    const color = keyColors[index]
    if (!color) continue
    let x = 13 + index * 10
    let y = /** @type {number | null} */ (null)

    while (x < LEVEL_WIDTH - 2) {
      y = getTopStandTileY(terrainRows, x)
      if (y != null && !occupiedTiles.has(`${x},${y}`)) break
      x += 1
    }

    if (y == null || occupiedTiles.has(`${x},${y}`)) continue

    objects.push({
      kind: "lock",
      x,
      y,
      width: 1,
      height: 1,
      solid: true,
      sprite: `lock_${color}`,
      collected: false,
    })
    occupiedTiles.add(`${x},${y}`)

    /** Two color blocks directly above the lock (separate objects; 4-adjacent for flood fill). */
    for (const dy of [1, 2]) {
      const by = y - dy
      if (by < 0) continue
      const tkey = `${x},${by}`
      if (occupiedTiles.has(tkey)) continue
      const row = terrainRows[by]
      if (!row || row[x] !== "0") continue
      objects.push({
        kind: "color_block",
        x,
        y: by,
        width: 1,
        height: 1,
        solid: true,
        sprite: `block_${color}`,
        collected: false,
      })
      occupiedTiles.add(tkey)
    }
  }

  return objects
}

/**
 * Exit door at the right side of the level. Passable only after every color lock is
 * opened (see {@link buildLockObjects}).
 *
 * @param {string[]} terrainRows
 * @param {Set<string>} occupiedTiles
 * @returns {GameLevelObject | null}
 */
function buildExitDoor(terrainRows, occupiedTiles) {
  for (let x = LEVEL_WIDTH - 3; x >= 4; x--) {
    const bottomY = getDoorBottomTileY(terrainRows, x)
    if (bottomY == null) continue
    const k0 = `${x},${bottomY}`
    const k1 = `${x},${bottomY - 1}`
    if (occupiedTiles.has(k0) || occupiedTiles.has(k1)) continue
    occupiedTiles.add(k0)
    occupiedTiles.add(k1)

    return {
      kind: "exit_door",
      x,
      y: bottomY,
      width: 1,
      height: 2,
      solid: true,
      sprite: "exit_door",
      collected: false,
    }
  }

  return null
}

/**
 * Horizontal pits between two standable columns (same air row): air + air below in the pit.
 * Bridges span the pit at {@link sl} (walkable row above the pit).
 *
 * @param {string[]} terrainRows
 * @returns {{ gx0: number, gx1: number, sl: number }[]}
 */
function findBridgeGaps(terrainRows) {
  const h = terrainRows.length
  const w = terrainRows[0]?.length ?? 0
  /** @type {{ gx0: number, gx1: number, sl: number }[]} */
  const gaps = []
  for (let sl = 1; sl < h - 2; sl++) {
    const row = terrainRows[sl]
    const below = terrainRows[sl + 1]
    if (!row || !below) continue
    let x = 2
    while (x < w - 2) {
      if (
        row[x] === "0" &&
        below[x] === "0" &&
        row[x - 1] === "0" &&
        below[x - 1] === "1"
      ) {
        const gx0 = x
        let gx = x
        while (gx < w - 1 && row[gx] === "0" && below[gx] === "0") gx++
        gx--
        if (gx >= gx0 && row[gx + 1] === "0" && below[gx + 1] === "1") {
          const gapW = gx - gx0 + 1
          if (gapW >= 2 && gapW <= 10) {
            gaps.push({ gx0, gx1: gx, sl })
          }
          x = gx + 2
          continue
        }
      }
      x++
    }
  }
  return gaps
}

/**
 * Another walkable surface exists below this stand in the same column (upper platform / island).
 *
 * @param {string[]} terrainRows
 * @param {number} x
 * @param {number} standY
 * @returns {boolean}
 */
function hasWalkableSurfaceBelow(terrainRows, x, standY) {
  for (let y = standY + 1; y < terrainRows.length - 1; y++) {
    if (terrainRows[y]?.[x] === "0" && terrainRows[y + 1]?.[x] === "1") {
      return true
    }
  }
  return false
}

/**
 * Solid terrain in the same row to the left or right (vertical wall beside the stand tile).
 *
 * @param {string[]} terrainRows
 * @param {number} x
 * @param {number} y
 * @returns {boolean}
 */
function isWallBesideStandSameRow(terrainRows, x, y) {
  const row = terrainRows[y]
  if (!row) return false
  return row[x - 1] === "1" || row[x + 1] === "1"
}

/**
 * Island / cliff top next to a wall face: multi-level column + horizontal wall edge.
 *
 * @param {string[]} terrainRows
 * @param {number} x
 * @param {number} standY
 * @returns {boolean}
 */
function isTorchIslandWallEdge(terrainRows, x, standY) {
  if (!isWallBesideStandSameRow(terrainRows, x, standY)) return false
  return hasWalkableSurfaceBelow(terrainRows, x, standY)
}

/**
 * Bridges across pits between islands (or none). Torches only on island/cliff tops beside wall edges.
 *
 * @param {string[]} terrainRows
 * @param {Set<string>} occupiedTiles
 * @param {() => number} rng
 * @returns {GameLevelObject[]}
 */
function buildBridgeTorchObjects(terrainRows, occupiedTiles, rng) {
  /** @type {GameLevelObject[]} */
  const out = []
  const bridgeKinds = [
    { kind: "bridge", sprite: "bridge" },
    { kind: "bridge_logs", sprite: "bridge_logs" },
  ]

  const placeBridges = rng() < 0.5
  if (placeBridges) {
    const gaps = findBridgeGaps(terrainRows)
    /** @type {typeof gaps} */
    const pool = [...gaps]
    const nBridges = Math.min(1 + Math.floor(rng() * 2), pool.length)
    for (let b = 0; b < nBridges && pool.length > 0; b++) {
      const idx = Math.floor(rng() * pool.length)
      const gap = pool.splice(idx, 1)[0]
      if (!gap) continue
      const pick = bridgeKinds[Math.floor(rng() * bridgeKinds.length)]
      if (!pick) continue
      for (let gx = gap.gx0; gx <= gap.gx1; gx++) {
        const tkey = `${gx},${gap.sl}`
        if (occupiedTiles.has(tkey)) continue
        out.push({
          kind: pick.kind,
          x: gx,
          y: gap.sl,
          width: 1,
          height: 1,
          sprite: pick.sprite,
          solid: true,
          collected: false,
        })
        occupiedTiles.add(tkey)
      }
    }
  }

  for (let i = 0; i < 14; i++) {
    if (rng() > 0.36) continue
    let placed = false
    for (let t = 0; t < 140 && !placed; t++) {
      const x = 4 + Math.floor(rng() * (LEVEL_WIDTH - 8))
      const standY = getTopStandTileY(terrainRows, x)
      if (standY == null) continue
      if (!isTorchIslandWallEdge(terrainRows, x, standY)) continue
      const tkey = `${x},${standY}`
      if (occupiedTiles.has(tkey)) continue
      out.push({
        kind: "torch",
        x,
        y: standY,
        width: 1,
        height: 1,
        sprite: "torch_on_a",
        solid: false,
        collected: false,
      })
      occupiedTiles.add(tkey)
      placed = true
    }
  }

  return out
}

/**
 * @param {string[]} terrainRows
 * @param {() => number} rng
 * @returns {{ x: number, y: number } | null}
 */
function findOpenAirTileForSaw(terrainRows, rng) {
  for (let t = 0; t < 70; t++) {
    const x = 4 + Math.floor(rng() * (LEVEL_WIDTH - 8))
    const y = 2 + Math.floor(rng() * (terrainRows.length - 6))
    const row = terrainRows[y]
    const below = terrainRows[y + 1]
    if (!row || !below) continue
    if (row[x] !== "0" || below[x] !== "0") continue
    let depth = 0
    for (let dy = 1; dy <= 8 && y + dy < terrainRows.length; dy++) {
      if (terrainRows[y + dy]?.[x] === "0") depth++
      else break
    }
    if (depth >= 3) return { x, y }
  }
  return null
}

/**
 * Springs, spikes, and saws (some saws float in open air).
 *
 * @param {string[]} terrainRows
 * @param {Set<string>} occupiedTiles
 * @param {() => number} rng
 * @returns {GameLevelObject[]}
 */
function buildHazardObjects(terrainRows, occupiedTiles, rng) {
  /** @type {GameLevelObject[]} */
  const out = []
  const kinds = [
    { kind: "spring", sprite: "spring", count: 3 },
    { kind: "spikes", sprite: "spikes", count: 7 },
  ]

  for (const spec of kinds) {
    for (let i = 0; i < spec.count; i++) {
      let placed = false
      for (let t = 0; t < 80 && !placed; t++) {
        const x = 4 + Math.floor(rng() * (LEVEL_WIDTH - 8))
        const standY = getTopStandTileY(terrainRows, x)
        if (standY == null) continue
        const tkey = `${x},${standY}`
        if (occupiedTiles.has(tkey)) continue
        /** @type {GameLevelObject} */
        const o = {
          kind: spec.kind,
          x,
          y: standY,
          width: 1,
          height: 1,
          sprite: spec.sprite,
          collected: false,
          solid: false,
        }
        out.push(o)
        occupiedTiles.add(tkey)
        placed = true
      }
    }
  }

  const sawStand = 3
  const sawAir = 2
  for (let i = 0; i < sawStand; i++) {
    let placed = false
    for (let t = 0; t < 80 && !placed; t++) {
      const x = 4 + Math.floor(rng() * (LEVEL_WIDTH - 8))
      const standY = getTopStandTileY(terrainRows, x)
      if (standY == null) continue
      const tkey = `${x},${standY}`
      if (occupiedTiles.has(tkey)) continue
      out.push({
        kind: "saw",
        x,
        y: standY,
        width: 1,
        height: 1,
        sprite: "saw",
        collected: false,
        solid: false,
        state: "0",
      })
      occupiedTiles.add(tkey)
      placed = true
    }
  }

  for (let i = 0; i < sawAir; i++) {
    const pos = findOpenAirTileForSaw(terrainRows, rng)
    if (!pos) continue
    const tkey = `${pos.x},${pos.y}`
    if (occupiedTiles.has(tkey)) continue
    out.push({
      kind: "saw",
      x: pos.x,
      y: pos.y,
      width: 1,
      height: 1,
      sprite: "saw",
      collected: false,
      solid: false,
      state: "0",
    })
    occupiedTiles.add(tkey)
  }

  return out
}

/**
 * Random special / brick blocks on stand tiles (question blocks, coins, decorative bricks).
 *
 * @param {string[]} terrainRows
 * @param {Set<string>} occupiedTiles
 * @param {() => number} rng
 * @returns {GameLevelObject[]}
 */
function buildInteractiveBlockObjects(terrainRows, occupiedTiles, rng) {
  const interactive = EDITOR_BLOCK_VARIANTS.filter((v) =>
    INTERACTIVE_BLOCK_KINDS.has(v.kind),
  )
  const bricks = EDITOR_BRICK_VARIANTS.filter(
    (v) => typeof v.sprite === "string" && v.kind !== "hill",
  )
  if (interactive.length === 0 && bricks.length === 0) return []

  /** @type {GameLevelObject[]} */
  const out = []
  const n = 5 + Math.floor(rng() * 5)
  for (let i = 0; i < n; i++) {
    let placed = false
    for (let t = 0; t < 70 && !placed; t++) {
      const x = 4 + Math.floor(rng() * (LEVEL_WIDTH - 8))
      const standY = getTopStandTileY(terrainRows, x)
      if (standY == null) continue
      const tkey = `${x},${standY}`
      if (occupiedTiles.has(tkey)) continue

      let variant
      if (rng() < 0.62 && interactive.length > 0) {
        variant = interactive[Math.floor(rng() * interactive.length)]
      } else if (bricks.length > 0) {
        variant = bricks[Math.floor(rng() * bricks.length)]
      } else {
        variant = interactive[Math.floor(rng() * interactive.length)]
      }
      if (!variant) continue

      out.push({
        kind: variant.kind,
        x,
        y: standY,
        width: 1,
        height: 1,
        sprite: variant.sprite,
        solid: variant.solid !== false,
        collected: false,
      })
      occupiedTiles.add(tkey)
      placed = true
    }
  }

  return out
}

/**
 * Floor switches (same colors as locks) near matching color blocks so {@link trySwitches} can toggle blocks.
 *
 * @param {string[]} terrainRows
 * @param {Set<string>} occupiedTiles
 * @param {GameLevelObject[]} objects
 * @param {() => number} rng
 * @returns {GameLevelObject[]}
 */
function buildSwitchObjects(terrainRows, occupiedTiles, objects, rng) {
  const colors = ["blue", "green", "red", "yellow"]
  /** @type {GameLevelObject[]} */
  const out = []
  const range = 10

  for (const color of colors) {
    const block = objects.find(
      (o) => o.kind === "color_block" && o.sprite === `block_${color}`,
    )
    if (!block) continue

    let placed = false
    for (let t = 0; t < 60 && !placed; t++) {
      const dx = Math.floor((rng() - 0.5) * (range * 2))
      const x = clamp(block.x + dx, 3, LEVEL_WIDTH - 4)
      const standY = getTopStandTileY(terrainRows, x)
      if (standY == null) continue
      const tkey = `${x},${standY}`
      if (occupiedTiles.has(tkey)) continue
      const dist = Math.abs(x - block.x) + Math.abs(standY - block.y)
      if (dist > range || dist < 2) continue

      out.push({
        kind: "switch",
        x,
        y: standY,
        width: 1,
        height: 1,
        sprite: `switch_${color}`,
        collected: false,
        solid: false,
      })
      occupiedTiles.add(tkey)
      placed = true
    }
  }

  return out
}

/**
 * First walkable air tile under open sky: air at (x,y) with solid directly below at (x,y+1).
 * Scanning top→bottom yields the highest reachable platform in that column.
 *
 * @param {string[]} terrainRows
 * @param {number} tileX
 * @returns {number | null}
 */
function getTopStandTileY(terrainRows, tileX) {
  for (let y = 1; y < terrainRows.length - 1; y++) {
    const row = terrainRows[y]
    const below = terrainRows[y + 1]
    if (row?.[tileX] === "0" && below?.[tileX] === "1") {
      return y
    }
  }
  return null
}

/**
 * Bottom row of a 2-tall door: air at y and y-1, solid at y+1.
 *
 * @param {string[]} terrainRows
 * @param {number} tileX
 * @returns {number | null}
 */
function getDoorBottomTileY(terrainRows, tileX) {
  for (let y = 1; y < terrainRows.length - 2; y++) {
    const r = terrainRows
    if (
      r[y]?.[tileX] === "0" &&
      r[y - 1]?.[tileX] === "0" &&
      r[y + 1]?.[tileX] === "1"
    ) {
      return y
    }
  }
  return null
}

/**
 * @param {number} index
 * @returns {string}
 */
function getGemSprite(index) {
  const sprites = ["gem_blue", "gem_green", "gem_red", "gem_yellow"]
  return sprites[index % sprites.length] ?? "gem_blue"
}

/**
 * Mulberry32 PRNG keeps generation deterministic from a saved seed.
 * @param {number} seed
 * @returns {() => number}
 */
function createRng(seed) {
  let state = seed >>> 0
  return function next() {
    state += 0x6d2b79f5
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 */
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}
