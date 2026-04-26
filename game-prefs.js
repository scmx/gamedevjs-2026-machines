import { getRandomUnusedPlayerSkin, PLAYER_SKINS } from "./game-state.js"

/** localStorage key (value is query-style: v=1&sk=12&l=1.1) */
const STORAGE_KEY = "game_prefs"

/** Bump when adding keys or changing semantics; readers ignore unknown keys. */
export const PREFS_SCHEMA_VERSION = 1

/**
 * @typedef {{
 *   version: number
 *   skinsByPlayerIndex: Record<number, string>
 *   levelIndex: number
 *   unlockedLocks: number
 * } | null} LoadedPrefs
 */

/**
 * @returns {LoadedPrefs}
 */
export function loadPlayerPrefs() {
  try {
    if (typeof localStorage === "undefined") return null
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return parsePrefsQueryString(raw)
  } catch {
    return null
  }
}

/**
 * @param {string} raw
 * @returns {LoadedPrefs}
 */
function parsePrefsQueryString(raw) {
  const q = raw.trim()
  if (!q) return null
  const params = new URLSearchParams(
    q.startsWith("?") ? q.slice(1) : q,
  )
  const vRaw = params.get("v")
  const v = vRaw === null ? NaN : Number(vRaw)
  if (!Number.isFinite(v) || v < 1 || v > PREFS_SCHEMA_VERSION + 100) {
    return null
  }
  const skinRaw = params.get("sk")
  const levelRaw = params.get("l")
  /** @type {Record<number, string>} */
  const skinsByPlayerIndex = {}
  if (skinRaw) {
    for (let i = 0; i < skinRaw.length; i++) {
      const digit = Number(skinRaw[i])
      if (!Number.isFinite(digit) || digit < 0) continue
      const skin = PLAYER_SKINS[digit]
      if (skin) skinsByPlayerIndex[i] = skin
    }
  } else {
    for (const [key, val] of params) {
      const m = /^p(\d+)$/.exec(key)
      if (!m) continue
      const idx = Number(m[1])
      if (!Number.isFinite(idx) || idx < 0) continue
      skinsByPlayerIndex[idx] = decodeURIComponent(val)
    }
  }
  let levelIndex = 0
  let unlockedLocks = 0
  if (levelRaw) {
    const m = /^(\d+)(?:\.(\d+))?$/.exec(levelRaw)
    if (m) {
      levelIndex = Number(m[1]) || 0
      unlockedLocks = Number(m[2] ?? 0) || 0
    }
  }
  return { version: v, skinsByPlayerIndex, levelIndex, unlockedLocks }
}

/**
 * @param {import('./game-state.js').GameActor[]} players
 * @param {NonNullable<LoadedPrefs>} prefs
 */
export function applySkinPrefsToPlayers(players, prefs) {
  for (let i = 0; i < players.length; i++) {
    const pl = players[i]
    const want = prefs.skinsByPlayerIndex[i]
    if (
      pl &&
      typeof want === "string" &&
      PLAYER_SKINS.includes(want)
    ) {
      pl.skin = want
    }
  }
  resolveDuplicateSkins(players)
}

/**
 * @param {import('./game-state.js').GameActor[]} players
 */
function resolveDuplicateSkins(players) {
  const used = new Set()
  for (const p of players) {
    if (!used.has(p.skin)) {
      used.add(p.skin)
      continue
    }
    p.skin = getRandomUnusedPlayerSkin(players.filter((q) => q !== p))
    used.add(p.skin)
  }
}

/**
 * @param {import('./game-state.js').GameModel} model
 */
export function savePlayerSkinsFromModel(model) {
  try {
    if (typeof localStorage === "undefined") return
    const parts = [`v=${PREFS_SCHEMA_VERSION}`]
    let skinDigits = ""
    for (let i = 0; i < model.players.length; i++) {
      const skin = model.players[i]?.skin
      const idx = PLAYER_SKINS.indexOf(skin ?? "")
      skinDigits += idx >= 0 ? String(idx) : "0"
    }
    if (skinDigits) parts.push(`sk=${skinDigits}`)
    const levelIndex = Number(model.currentLevelIndex ?? 0) || 0
    const unlockedLocks = Number(model.unlockedLocks ?? 0) || 0
    parts.push(`l=${levelIndex}.${unlockedLocks}`)
    localStorage.setItem(STORAGE_KEY, parts.join("&"))
  } catch {
    // quota / private mode
  }
}
