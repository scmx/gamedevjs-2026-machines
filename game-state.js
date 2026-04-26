export class GameVector {
  /**
   * @param {number} [x]
   * @param {number} [y]
   */
  constructor(x = 0, y = 0) {
    /** @type {number} */
    this.x = x
    /** @type {number} */
    this.y = y
  }
}

export const PLAYER_SKINS = Object.freeze([
  "beige",
  "green",
  "pink",
  "purple",
  "yellow",
])
export const TILE_SIZE = 48
const PLAYER_SPAWNS = Object.freeze([
  { x: 120, y: 120, color: "#f59e0b" },
  { x: 180, y: 120, color: "#38bdf8" },
])

import { ensureTerrainVariant } from "./terrain-biome.js"

export class GameActor {
  constructor() {
    /** @type {GameVector} */
    this.oldPos = new GameVector()
    /** @type {GameVector} */
    this.pos = new GameVector()
    /** @type {GameVector} */
    this.velocity = new GameVector()
    /** @type {GameVector} */
    this.size = new GameVector(24, 24)
    /** @type {number} */
    this.speed = 220
    /** @type {string} */
    this.color = "#f8fafc"
    /** @type {string} */
    this.skin = "beige"
    /** @type {boolean} */
    this.grounded = false
    /** @type {boolean} */
    this.cycleSkinPressed = false
    /** @type {number} */
    this.hearts = 3
    /** @type {number} */
    this.maxHearts = 3
    /** @type {number} */
    this.heartHalves = 6
    /** @type {number} */
    this.maxHeartHalves = 6
    /** @type {number} */
    this.hurtCooldown = 0
    /** @type {number} */
    this.gems = 0
    /** @type {number} */
    this.coins = 0
    /** @type {boolean} */
    this.shootPressed = false
    /** Edge-detect for punch / interact near blocks (keyboard X, gamepad face X). */
    /** @type {boolean} */
    this.punchBlockPressed = false
    /** @type {Record<string, boolean>} */
    this.keys = {
      blue: false,
      green: false,
      red: false,
      yellow: false,
    }
    /** @type {number} */
    this.index = 0
    /** @type {boolean} */
    this.onLadder = false
    /** @type {boolean} */
    this.inWater = false
  }
}

export class GameModel {
  /**
   * @param {{ levels?: GameLevel[] }} [options]
   */
  constructor(options = {}) {
    const { levels = [] } = options
    for (const lv of levels) {
      if (lv) ensureTerrainVariant(lv)
    }
    const activeLevel = levels[0]
    /** @type {number} */
    this.interval = 1000 / 60
    /** @type {number} */
    this.gravity = 1200
    /** @type {number} */
    this.jumpSpeed = 520
    /** @type {number} */
    this.frameTime = 0
    /** @type {number} */
    this.simulationTime = 0
    /** @type {GameWorld} */
    this.world = {
      width: activeLevel ? activeLevel.width * TILE_SIZE : 960,
      height: activeLevel ? activeLevel.height * TILE_SIZE : 540,
      background: "#0f172a",
      ground: "#1e293b",
    }
    /** @type {GameCamera} */
    this.camera = {
      x: 0,
      y: 0,
      viewportWidth: 960,
      viewportHeight: 540,
    }
    /** @type {GameLevel[]} */
    this.levels = levels
    /** @type {GameActor[]} */
    this.players = []
    this.players.push(createDefaultPlayer(0, this.players))
    /** @type {number} */
    this.elapsed = 0

    /**
     * Shared: either player’s editor-toggle (B) enters or exits editor for both.
     * @type {boolean}
     */
    this.editorMode = false
    /** @type {boolean} */
    this.menuOpen = false
    /** @type {0 | 1 | 2 | 3} */
    this.musicVolume = 3
    /** @type {0 | 1 | 2 | 3} */
    this.sfxVolume = 3
    /** Edge-detect helper for combined B (either player). @type {boolean} */
    this._editorPrevToggleAny = false
    /** Edge-detect helper for combined menu toggle. @type {boolean} */
    this._menuPrevToggleAny = false
    /** @type {[number, number]} */
    this.editorTileX = [4, 4]
    /** @type {[number, number]} */
    this.editorTileY = [4, 4]
    /** @type {[number, number]} */
    this.editorThingIndex = [0, 0]
    /** @type {[number, number]} */
    this.editorColorIndex = [0, 0]
    /** @type {[number, number]} */
    this.editorBiomeIndex = [0, 0]
    /** @type {[number, number]} */
    this.editorBlockVariantIndex = [0, 0]
    /** @type {[number, number]} */
    this.editorBridgeVariantIndex = [0, 0]
    /** @type {[number, number]} */
    this.editorRopeVariantIndex = [0, 0]
    /** @type {[number, number]} */
    this.editorRockVariantIndex = [0, 0]
    /** @type {[number, number]} */
    this.editorHazardVariantIndex = [0, 0]
    /** @type {[number, number]} */
    this.editorBrickVariantIndex = [0, 0]
    /** @type {[number, number]} */
    this.editorCoinVariantIndex = [0, 0]
    /** @type {[boolean, boolean]} */
    this.editorSpikeUpsideDown = [false, false]
    /** @type {[Record<string, number>, Record<string, number>]} */
    this.editorColorsById = [{}, {}]
    /** @type {number} */
    this.terrainRevision = 0
    /** @type {[boolean, boolean]} */
    this._editorPrevPlace = [false, false]
    /** @type {[boolean, boolean]} */
    this._editorPrevRemove = [false, false]
    /** @type {[boolean, boolean]} */
    this._editorPrevUndo = [false, false]
    /** @type {[boolean, boolean]} */
    this._editorPrevLevelNext = [false, false]
    /** @type {[boolean, boolean]} */
    this._editorPrevLevelPrev = [false, false]
    /** @type {[boolean, boolean]} */
    this._editorPrevCycleNext = [false, false]
    /** @type {[boolean, boolean]} */
    this._editorPrevCyclePrev = [false, false]
    /** @type {[boolean, boolean]} */
    this._editorPrevColor = [false, false]
    /** @type {[boolean, boolean]} */
    this._editorPrevCursorUp = [false, false]
    /** @type {[boolean, boolean]} */
    this._editorPrevCursorDown = [false, false]
    /** @type {[boolean, boolean]} */
    this._editorPrevCursorLeft = [false, false]
    /** @type {[boolean, boolean]} */
    this._editorPrevCursorRight = [false, false]
    /** Fluid tool: water vs lava (cycled with same variant keys as other tools). @type {[boolean, boolean]} */
    this.editorFluidIsLava = [false, false]
    /** Conveyor tool: 0 = belt right, 1 = belt left. @type {[number, number]} */
    this.editorConveyorDirIndex = [0, 0]
    /** Cursor moved this frame (arrow step); camera averages only these when non-empty. @type {[boolean, boolean]} */
    this.editorCursorMovedThisFrame = [false, false]
    /** @type {number} */
    this._fishSpawnAccumulator = 0
    /** Ordered editor ops on top of the procedural seed; downloadable as JSON. @type {object[]} */
    this.editLog = []
    /** @type {number} */
    this.currentLevelIndex = 0
    /** @type {number} Count of unlocked locks from the left. */
    this.unlockedLocks = 0
    /** @type {{ x: number, y: number } | null} */
    this.lastUnlockedLockRespawn = null
  }
}

/**
 * @param {GameModel} model
 * @returns {boolean}
 */
export function isAnyEditorActive(model) {
  return model.editorMode === true
}

export class GameView {
  /**
   * @param {CanvasRenderingContext2D} back
   * @param {CanvasRenderingContext2D} tiles
   * @param {CanvasRenderingContext2D} objects
   */
  constructor(back, tiles, objects) {
    this.ctx = { back, tiles, objects }
    this.scale = 1
  }
}

/**
 * @param {{ levels?: GameLevel[] }} [options]
 * @returns {GameModel}
 */
export function createGameModel(options) {
  return new GameModel(options)
}

/**
 * @param {HTMLCanvasElement} back
 * @param {HTMLCanvasElement} tiles
 * @param {HTMLCanvasElement} objects
 * @returns {GameView}
 */
export function createGameView(back, tiles, objects) {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  const getContext = (canvas) =>
    /** @type {CanvasRenderingContext2D} */ (canvas.getContext("2d"))
  return new GameView(getContext(back), getContext(tiles), getContext(objects))
}

/**
 * @param {number} index
 * @param {number} x
 * @param {number} y
 * @param {string} color
 * @param {string} [skin]
 */
export function createPlayer(index, x, y, color, skin) {
  const player = new GameActor()
  player.index = index
  player.oldPos = new GameVector(x, y)
  player.pos = new GameVector(x, y)
  player.color = color
  player.skin = skin ?? PLAYER_SKINS[index % PLAYER_SKINS.length] ?? "beige"
  return player
}

/** @returns {string} */
export function getRandomPlayerSkin() {
  const index = Math.floor(Math.random() * PLAYER_SKINS.length)
  return PLAYER_SKINS[index] ?? "beige"
}

/**
 * @param {GameActor[]} players
 * @returns {string}
 */
export function getRandomUnusedPlayerSkin(players) {
  const usedSkins = new Set(players.map((player) => player.skin))
  const availableSkins = PLAYER_SKINS.filter((skin) => !usedSkins.has(skin))

  if (availableSkins.length === 0) {
    return getRandomPlayerSkin()
  }

  const index = Math.floor(Math.random() * availableSkins.length)
  return availableSkins[index] ?? "beige"
}

/**
 * @param {GameModel} model
 * @param {GameActor} player
 */
export function cyclePlayerSkin(model, player) {
  const otherPlayers = model.players.filter((candidate) => candidate !== player)
  const blockedSkins = new Set(otherPlayers.map((candidate) => candidate.skin))
  const availableSkins = PLAYER_SKINS.filter((skin) => !blockedSkins.has(skin))
  const currentIndex = availableSkins.indexOf(player.skin)
  const nextIndex =
    currentIndex >= 0 ? (currentIndex + 1) % availableSkins.length : 0
  const nextSkin = availableSkins[nextIndex]

  if (nextSkin) {
    player.skin = nextSkin
  }
}

/**
 * @param {GameModel} model
 * @param {number} count
 */
export function syncPlayerCount(model, count) {
  while (model.players.length < count) {
    model.players.push(createDefaultPlayer(model.players.length, model.players))
  }

  if (model.players.length > count) {
    model.players.length = count
  }
}

/**
 * @param {number} index
 * @param {GameActor[]} players
 * @returns {GameActor}
 */
function createDefaultPlayer(index, players) {
  const spawn = PLAYER_SPAWNS[index] ?? {
    x: 120 + index * 60,
    y: 120,
    color: "#f8fafc",
  }
  return createPlayer(
    index,
    spawn.x,
    spawn.y,
    spawn.color,
    getRandomUnusedPlayerSkin(players),
  )
}

/**
 * Snap players to spawn positions and clear per-level keys after a level transition.
 *
 * @param {GameModel} model
 */
export function resetPlayersForNewLevel(model) {
  for (let i = 0; i < model.players.length; i++) {
    const player = model.players[i]
    if (!player) continue
    const spawn = PLAYER_SPAWNS[i] ?? {
      x: 120 + i * 60,
      y: 120,
      color: "#f8fafc",
    }
    player.pos.x = spawn.x
    player.pos.y = spawn.y
    player.oldPos.x = spawn.x
    player.oldPos.y = spawn.y
    player.velocity.x = 0
    player.velocity.y = 0
    player.grounded = false
    player.keys = {
      blue: false,
      green: false,
      red: false,
      yellow: false,
    }
  }
  model.unlockedLocks = 0
  model.lastUnlockedLockRespawn = null
}

/**
 * When a player runs out of health, snap them back to spawn with full hearts.
 *
 * @param {GameModel} model
 */
export function respawnPlayersIfDead(model) {
  const spawn = model.lastUnlockedLockRespawn
  for (const player of model.players) {
    if (player.heartHalves > 0) continue
    const i = player.index
    const fallback = PLAYER_SPAWNS[i] ?? {
      x: 120 + i * 60,
      y: 120,
      color: "#f8fafc",
    }
    const sx = spawn?.x ?? fallback.x
    const sy = spawn?.y ?? fallback.y
    player.pos.x = sx
    player.pos.y = sy
    player.oldPos.x = sx
    player.oldPos.y = sy
    player.velocity.x = 0
    player.velocity.y = 0
    player.grounded = false
    player.heartHalves = player.maxHeartHalves
    player.hearts = player.maxHearts
    player.hurtCooldown = 0
  }
}
