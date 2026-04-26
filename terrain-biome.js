/** @typedef {'grass'|'snow'|'sand'|'stone'|'dirt'|'purple'} TerrainBiome */

/** @type {readonly TerrainBiome[]} */
/** Terrain tool cycles these biomes (hill is an object, not terrain). */
export const TERRAIN_BIOMES = Object.freeze([
  "grass",
  "snow",
  "sand",
  "stone",
  "dirt",
  "purple",
])

/** Single-char id per solid cell (air = space). */
const _BIOME_CHARS = /** @type {const} */ ({
  grass: "g",
  snow: "w",
  sand: "s",
  stone: "t",
  dirt: "d",
  purple: "p",
})

/** @type {Record<string, TerrainBiome>} */
const CHAR_TO_BIOME = {
  g: "grass",
  w: "snow",
  s: "sand",
  t: "stone",
  d: "dirt",
  p: "purple",
}

/**
 * @param {TerrainBiome} biome
 * @returns {string}
 */
export function biomeToChar(biome) {
  return _BIOME_CHARS[biome] ?? "g"
}

/**
 * @param {string} [ch]
 * @returns {TerrainBiome}
 */
export function charToBiome(ch) {
  if (!ch || ch === " ") return "grass"
  const b = CHAR_TO_BIOME[ch]
  return b ?? "grass"
}

/**
 * @param {number} seed
 * @returns {TerrainBiome}
 */
export function biomeFromSeed(seed) {
  return /** @type {TerrainBiome} */ (
    TERRAIN_BIOMES[seed % TERRAIN_BIOMES.length] ?? "grass"
  )
}

/**
 * Ensure `layers.terrainVariant` exists and matches `terrain` dimensions.
 *
 * @param {GameLevel} level
 */
export function ensureTerrainVariant(level) {
  const terrain = level.layers.terrain
  const existing = level.layers.terrainVariant
  if (
    existing &&
    existing.length === terrain.length &&
    (terrain.length === 0 || (existing[0]?.length === terrain[0]?.length))
  ) {
    return
  }
  const seed = level.generatedFrom.seed
  const biome = biomeFromSeed(seed)
  const ch = biomeToChar(biome)
  /** @type {string[]} */
  const rows = []
  for (const row of terrain) {
    let v = ""
    for (let i = 0; i < row.length; i++) {
      v += row[i] === "1" ? ch : " "
    }
    rows.push(v)
  }
  level.layers.terrainVariant = rows
}

/**
 * @param {TerrainBiome} biome
 * @returns {"melody" | "ambient" | "arcade"}
 */
export function musicModeForBiome(biome) {
  switch (biome) {
    case "grass":
      return "melody"
    case "snow":
      return "ambient"
    case "sand":
      return "ambient"
    case "stone":
      return "arcade"
    case "dirt":
      return "melody"
    case "purple":
      return "arcade"
    default:
      return "melody"
  }
}
