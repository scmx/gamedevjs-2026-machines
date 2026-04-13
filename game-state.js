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
    /** @type {number} */
    this.index = 0
  }
}

export class GameModel {
  constructor() {
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
      width: 960,
      height: 540,
      background: "#0f172a",
      ground: "#1e293b",
    }
    /** @type {GameActor[]} */
    this.players = [createPlayer(0, 120, 120, "#f59e0b")]
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

/** @returns {GameModel} */
export function createGameModel() {
  return new GameModel()
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
 */
export function createPlayer(index, x, y, color) {
  const skins = ["beige", "green", "pink", "purple", "yellow"]
  const player = new GameActor()
  player.index = index
  player.oldPos = new GameVector(x, y)
  player.pos = new GameVector(x, y)
  player.color = color
  player.skin = skins[index % skins.length] ?? "beige"
  return player
}
