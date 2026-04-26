/**
 * Project persistence for mounted data folders.
 * Stores a compact `levels.json` with one record per level.
 */

/**
 * @typedef {{
 *   seed: number
 *   v: number
 *   levelVersion: number
 *   music?: "melody" | "ambient" | "arcade"
 *   ops: ProjectOp[]
 * }} ProjectLevelRecord
 *
 * @typedef {import("./editor-edit-log.js").EditLogOp} EditLogOp
 *
 * Compact on-disk op format.
 * @typedef {
 *   | ["wp", number, number]
 *   | ["lp", number, number]
 *   | ["wr", number, number]
 *   | ["lr", number, number]
 *   | ["tt", number, number, string, 0 | 1]
 *   | ["tc", number, number]
 *   | ["oa", unknown]
 *   | ["od", number, number]
 *   | ["ld", number, number]
 * } ProjectOp
 */

export const PROJECT_FILE_NAME = "levels.json"

/**
 * Compact project-file serializer that keeps each op array on its own line.
 *
 * @param {ProjectLevelRecord[]} records
 * @returns {string}
 */
export function formatProjectJson(records) {
  const out = []
  out.push('{"levels":[')
  records.forEach((record, i) => {
    out.push(formatLevelRecord(record) + (i + 1 < records.length ? "," : ""))
  })
  out.push("]}")
  return out.join("\n")
}

/**
 * @param {ProjectLevelRecord} record
 * @returns {string}
 */
function formatLevelRecord(record) {
  const head = [`{"seed":${record.seed ?? 0}`]
  head.push(`,"v":${record.v ?? 1}`)
  head.push(`,"levelVersion":${record.levelVersion ?? 1}`)
  if (record.music) head.push(`,"music":${JSON.stringify(record.music)}`)
  head.push(`,"ops":[`)
  const ops = (record.ops ?? []).map((op, i, arr) =>
    `  ${JSON.stringify(op)}${i + 1 < arr.length ? "," : ""}`,
  )
  return [...head, ...ops, "]}"].join("\n")
}

/**
 * @param {EditLogOp} op
 * @returns {ProjectOp}
 */
export function encodeOp(op) {
  switch (op.op) {
    case "waterPlace":
      return ["wp", op.x, op.y]
    case "lavaPlace":
      return ["lp", op.x, op.y]
    case "waterRemove":
      return ["wr", op.x, op.y]
    case "lavaRemove":
      return ["lr", op.x, op.y]
    case "terrainToggle":
      return ["tt", op.x, op.y, op.biomeChar, op.flood ? 1 : 0]
    case "terrainClear":
      return ["tc", op.x, op.y]
    case "objectAdd":
      return ["oa", op.obj]
    case "objectRemoveTile":
      return ["od", op.tx, op.ty]
    case "ladderPlace":
      return ["ld", op.x, op.y]
    default:
      return ["tc", 0, 0]
  }
}

/**
 * @param {ProjectOp} op
 * @returns {EditLogOp | null}
 */
export function decodeOp(op) {
  switch (op[0]) {
    case "wp":
      return { op: "waterPlace", x: op[1] ?? 0, y: op[2] ?? 0 }
    case "lp":
      return { op: "lavaPlace", x: op[1] ?? 0, y: op[2] ?? 0 }
    case "wr":
      return { op: "waterRemove", x: op[1] ?? 0, y: op[2] ?? 0 }
    case "lr":
      return { op: "lavaRemove", x: op[1] ?? 0, y: op[2] ?? 0 }
    case "tt":
      return {
        op: "terrainToggle",
        x: op[1] ?? 0,
        y: op[2] ?? 0,
        biomeChar: String(op[3] ?? "g"),
        flood: Boolean(op[4]),
      }
    case "tc":
      return { op: "terrainClear", x: op[1] ?? 0, y: op[2] ?? 0 }
    case "oa":
      return { op: "objectAdd", obj: op[1] }
    case "od":
      return {
        op: "objectRemoveTile",
        tx: op[1] ?? 0,
        ty: op[2] ?? 0,
      }
    case "ld":
      return { op: "ladderPlace", x: op[1] ?? 0, y: op[2] ?? 0 }
    default:
      return null
  }
}

/**
 * @param {import("./game-state.js").GameModel} model
 * @returns {ProjectLevelRecord[]}
 */
export function serializeProjectLevels(model) {
  return model.levels.map((level) => ({
    seed: level.generatedFrom?.seed ?? 0,
    v: 1,
    levelVersion: level.generatedFrom?.version ?? 0,
    music: level.generatedFrom?.music,
    ops: level.generatedFrom?.ops?.map(encodeOp) ?? [],
  }))
}

/**
 * @param {ProjectLevelRecord[]} records
 * @returns {ProjectLevelRecord[]}
 */
export function normalizeProjectLevels(records) {
  return records.map((r) => ({
    seed: r.seed ?? 0,
    v: r.v ?? 1,
    levelVersion: r.levelVersion ?? 1,
    music: r.music,
    ops: Array.isArray(r.ops) ? r.ops : [],
  }))
}
