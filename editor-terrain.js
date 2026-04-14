const LEVEL_VERSION = 1
const LEVEL_WIDTH = 48
const LEVEL_HEIGHT = 12

/**
 * @returns {GameLevel}
 */
export function generateLevel() {
  const seed = createSeed()
  const terrain = buildTerrainRows(seed)
  const occupiedTiles = new Set()
  const objects = [
    ...buildGemObjects(terrain, occupiedTiles),
    ...buildKeyObjects(terrain, occupiedTiles),
    ...buildLockObjects(terrain, occupiedTiles),
  ]

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
 * @returns {string[]}
 */
function buildTerrainRows(seed) {
  const rng = createRng(seed)
  const surface = []
  let height = 7

  for (let x = 0; x < LEVEL_WIDTH; x++) {
    if (x > 1 && x < LEVEL_WIDTH - 2) {
      const roll = rng()
      if (roll < 0.25) height -= 1
      else if (roll > 0.75) height += 1
    }
    height = clamp(height, 5, 8)
    surface.push(height)
  }

  /** @type {string[]} */
  const rows = []
  for (let y = 0; y < LEVEL_HEIGHT; y++) {
    let row = ""
    for (let x = 0; x < LEVEL_WIDTH; x++) {
      const surfaceHeight = surface[x] ?? LEVEL_HEIGHT
      row += y >= surfaceHeight ? "1" : "0"
    }
    rows.push(row)
  }

  return rows
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
    const surfaceY = getSurfaceY(terrainRows, x)
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
    let surfaceY = getSurfaceY(terrainRows, x)
    let y = Math.max(1, surfaceY - 1)

    while (x < LEVEL_WIDTH - 1 && occupiedTiles.has(`${x},${y}`)) {
      x += 1
      surfaceY = getSurfaceY(terrainRows, x)
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
    let surfaceY = getSurfaceY(terrainRows, x)
    let y = Math.max(1, surfaceY - 1)

    while (x < LEVEL_WIDTH - 1 && occupiedTiles.has(`${x},${y}`)) {
      x += 1
      surfaceY = getSurfaceY(terrainRows, x)
      y = Math.max(1, surfaceY - 1)
    }

    if (occupiedTiles.has(`${x},${y}`)) continue

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
  }

  return objects
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
