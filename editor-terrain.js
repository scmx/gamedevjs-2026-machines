const LEVEL_VERSION = 1
const LEVEL_WIDTH = 48
const LEVEL_HEIGHT = 12

/**
 * @returns {GameLevel}
 */
export function generateLevel() {
  const seed = createSeed()
  const terrain = buildTerrainRows(seed)

  return {
    id: `generated-${seed}`,
    name: "Generated Test Level",
    width: LEVEL_WIDTH,
    height: LEVEL_HEIGHT,
    layers: {
      terrain,
    },
    objects: [],
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
