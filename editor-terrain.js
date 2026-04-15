const LEVEL_VERSION = 2
const LEVEL_WIDTH = 48
/** Taller level for sky islands, deep valleys, and full-height edge walls. */
const LEVEL_HEIGHT = 22

/**
 * @param {number} [seed]
 * @returns {GameLevel}
 */
export function generateLevel(seed = createSeed()) {
  const { terrain, mainSurfaceY } = buildTerrainRows(seed)
  const occupiedTiles = new Set()
  const objects = [
    ...buildGemObjects(terrain, occupiedTiles, mainSurfaceY),
    ...buildKeyObjects(terrain, occupiedTiles, mainSurfaceY),
    ...buildLockObjects(terrain, occupiedTiles, mainSurfaceY),
  ]
  const exitDoor = buildExitDoor(terrain, occupiedTiles, mainSurfaceY)
  if (exitDoor) {
    objects.push(exitDoor)
  }

  return {
    id: `generated-${seed}`,
    name: "Generated Test Level",
    width: LEVEL_WIDTH,
    height: LEVEL_HEIGHT,
    layers: {
      terrain,
    },
    objects,
    generatedFrom: {
      version: LEVEL_VERSION,
      seed,
    },
  }
}

/** @returns {number} */
function createSeed() {
  return Math.floor(Math.random() * 1_000_000_000)
}

/**
 * @param {number} seed
 * @returns {{ terrain: string[], mainSurfaceY: number[] }}
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
    solid[y][0] = true
    solid[y][w - 1] = true
  }

  for (let y = h - 2; y < h; y++) {
    for (let x = 0; x < w; x++) {
      solid[y][x] = true
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
      solid[y][x] = true
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
        if (y >= 1 && y < h - 2) solid[y][x] = true
      }
    }
  }

  thickenEdgeWalls(solid, h, w)

  /** @type {string[]} */
  const rows = []
  for (let y = 0; y < h; y++) {
    let row = ""
    for (let x = 0; x < w; x++) {
      row += solid[y][x] ? "1" : "0"
    }
    rows.push(row)
  }

  return { terrain: rows, mainSurfaceY }
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
    solid[y][1] = true
    solid[y][w - 2] = true
  }
}

/**
 * @param {string[]} terrainRows
 * @param {Set<string>} occupiedTiles
 * @param {number[]} mainSurfaceY
 * @returns {GameLevelObject[]}
 */
function buildGemObjects(terrainRows, occupiedTiles, mainSurfaceY) {
  /** @type {GameLevelObject[]} */
  const objects = []

  for (let x = 3; x < LEVEL_WIDTH - 3; x += 5) {
    const surfaceY = mainSurfaceY[x] ?? getSurfaceY(terrainRows, x)
    if (surfaceY <= 1) continue
    const tileKey = `${x},${surfaceY - 1}`
    if (occupiedTiles.has(tileKey)) continue

    objects.push({
      kind: "gem",
      x,
      y: surfaceY - 1,
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
 * @param {number[]} mainSurfaceY
 * @returns {GameLevelObject[]}
 */
function buildKeyObjects(terrainRows, occupiedTiles, mainSurfaceY) {
  const keyColors = ["blue", "green", "red", "yellow"]
  /** @type {GameLevelObject[]} */
  const objects = []

  for (let index = 0; index < keyColors.length; index++) {
    const color = keyColors[index]
    if (!color) continue
    let x = 8 + index * 10
    let surfaceY = mainSurfaceY[x] ?? getSurfaceY(terrainRows, x)
    let y = Math.max(1, surfaceY - 1)

    while (x < LEVEL_WIDTH - 1 && occupiedTiles.has(`${x},${y}`)) {
      x += 1
      surfaceY = mainSurfaceY[x] ?? getSurfaceY(terrainRows, x)
      y = Math.max(1, surfaceY - 1)
    }

    if (occupiedTiles.has(`${x},${y}`)) continue

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
 * @param {number[]} mainSurfaceY
 * @returns {GameLevelObject[]}
 */
function buildLockObjects(terrainRows, occupiedTiles, mainSurfaceY) {
  const keyColors = ["blue", "green", "red", "yellow"]
  /** @type {GameLevelObject[]} */
  const objects = []

  for (let index = 0; index < keyColors.length; index++) {
    const color = keyColors[index]
    if (!color) continue
    let x = 13 + index * 10
    let surfaceY = mainSurfaceY[x] ?? getSurfaceY(terrainRows, x)
    let y = Math.max(1, surfaceY - 1)

    while (x < LEVEL_WIDTH - 1 && occupiedTiles.has(`${x},${y}`)) {
      x += 1
      surfaceY = mainSurfaceY[x] ?? getSurfaceY(terrainRows, x)
      y = Math.max(1, surfaceY - 1)
    }

    if (occupiedTiles.has(`${x},${y}`)) continue

    objects.push({
      kind: "lock",
      x,
      y,
      width: 1,
      height: 3,
      solid: true,
      sprite: `lock_${color}`,
      collected: false,
    })
    occupiedTiles.add(`${x},${y}`)
  }

  return objects
}

/**
 * Exit door at the right side of the level. Passable only after every color lock is
 * opened (see {@link buildLockObjects}).
 *
 * @param {string[]} terrainRows
 * @param {Set<string>} occupiedTiles
 * @param {number[]} mainSurfaceY
 * @returns {GameLevelObject | null}
 */
function buildExitDoor(terrainRows, occupiedTiles, mainSurfaceY) {
  /** Last interior column before the right cliff (`w - 2` is a full-height wall). */
  let x = LEVEL_WIDTH - 3
  let surfaceY = mainSurfaceY[x] ?? getSurfaceY(terrainRows, x)
  let y = Math.max(1, surfaceY - 1)

  while (x > 2 && occupiedTiles.has(`${x},${y}`)) {
    x -= 1
    surfaceY = mainSurfaceY[x] ?? getSurfaceY(terrainRows, x)
    y = Math.max(1, surfaceY - 1)
  }

  if (occupiedTiles.has(`${x},${y}`)) {
    return null
  }

  occupiedTiles.add(`${x},${y}`)

  return {
    kind: "exit_door",
    x,
    y,
    width: 1,
    height: 2,
    solid: true,
    sprite: "exit_door",
    collected: false,
  }
}

/**
 * @param {string[]} terrainRows
 * @param {number} tileX
 * @returns {number}
 */
function getSurfaceY(terrainRows, tileX) {
  for (let y = 0; y < terrainRows.length; y++) {
    const row = terrainRows[y]
    if (row?.[tileX] === "1") {
      return y
    }
  }

  return LEVEL_HEIGHT
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
