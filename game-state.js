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
    this.gems = 0
    /** @type {number} */
    this.index = 0
  }
}

export class GameModel {
  /**
   * @param {{ levels?: GameLevel[] }} [options]
   */
  constructor(options = {}) {
    const { levels = [] } = options
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
  }
}

export class GameView {
  /**
   * @param {CanvasRenderingContext2D} ctx
   */
  constructor(ctx) {
    this.ctx = ctx
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
 * @param {CanvasRenderingContext2D} ctx
 * @returns {GameView}
 */
export function createGameView(ctx) {
  return new GameView(ctx)
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
