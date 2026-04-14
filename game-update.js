import { TILE_SIZE, cyclePlayerSkin } from "./game-state.js"

/**
 * @param {import('./game-state.js').GameModel} model
 * @param {GameInput[]} inputs
 * @param {number} deltaTime
 */
export function update(model, inputs, deltaTime) {
  model.elapsed += deltaTime

  for (const player of model.players) {
    const input = inputs[player.index] ?? EMPTY_INPUT
    updatePlayer(player, model, input, deltaTime)
  }

  collectPickups(model)
  constrainPlayerSpacing(model)
}

/**
 * @param {GameActorData} player
 * @param {import('./game-state.js').GameModel} model
 * @param {GameInput} input
 * @param {number} deltaTime
 */
export function updatePlayer(player, model, input, deltaTime) {
  player.oldPos.x = player.pos.x
  player.oldPos.y = player.pos.y

  if (input.cycleSkin && !player.cycleSkinPressed) {
    cyclePlayerSkin(model, player)
  }
  player.cycleSkinPressed = input.cycleSkin

  const axisX = Number(input.right) - Number(input.left)
  if (input.jump && player.grounded) {
    player.velocity.y = -model.jumpSpeed
    player.grounded = false
  }

  player.velocity.x = axisX * player.speed
  player.velocity.y += model.gravity * deltaTime
  player.pos.x += player.velocity.x * deltaTime
  player.pos.y += player.velocity.y * deltaTime

  const floorY = getFloorY(model, player)
  player.pos.x = clamp(player.pos.x, 0, model.world.width - player.size.x)
  player.pos.y = clamp(player.pos.y, 0, floorY)
  player.grounded = false
  if (player.pos.y >= floorY) {
    player.velocity.y = 0
    player.grounded = true
  }
}

const EMPTY_INPUT = Object.freeze({
  cycleSkin: false,
  down: false,
  jump: false,
  left: false,
  right: false,
})

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 */
export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

/**
 * @param {import('./game-state.js').GameModel} model
 * @param {GameActorData} player
 * @returns {number}
 */
function getFloorY(model, player) {
  const level = model.levels[0]
  if (!level?.layers.terrain.length) {
    return model.world.height - 96 - player.size.y
  }

  const terrainRows = level.layers.terrain
  const tileSize = model.world.width / level.width
  const centerX = player.pos.x + player.size.x / 2
  const tileX = clamp(Math.floor(centerX / tileSize), 0, level.width - 1)

  for (let tileY = 0; tileY < terrainRows.length; tileY++) {
    const row = terrainRows[tileY]
    if (!row || row[tileX] !== "1") continue
    return tileY * tileSize - player.size.y
  }

  return model.world.height - player.size.y
}

/**
 * @param {import('./game-state.js').GameModel} model
 */
function collectPickups(model) {
  const level = model.levels[0]
  if (!level) return

  for (const object of level.objects) {
    if (object.kind !== "gem" || object.collected) continue

    for (const player of model.players) {
      if (!isOverlapping(player, object)) continue
      object.collected = true
      player.gems += 1
      break
    }
  }
}

/**
 * @param {GameActorData} player
 * @param {GameLevelObject} object
 * @returns {boolean}
 */
function isOverlapping(player, object) {
  const objectX = object.x * TILE_SIZE
  const objectY = object.y * TILE_SIZE
  const objectWidth = object.width * TILE_SIZE
  const objectHeight = object.height * TILE_SIZE

  return (
    player.pos.x < objectX + objectWidth &&
    player.pos.x + player.size.x > objectX &&
    player.pos.y < objectY + objectHeight &&
    player.pos.y + player.size.y > objectY
  )
}

/**
 * Keep the active pair within the current camera view width so neither can leave the screen.
 * @param {import('./game-state.js').GameModel} model
 */
function constrainPlayerSpacing(model) {
  if (model.players.length < 2) return

  const leftPlayer = model.players[0]
  const rightPlayer = model.players[1]
  if (!leftPlayer || !rightPlayer) return

  const [playerA, playerB] =
    leftPlayer.pos.x <= rightPlayer.pos.x
      ? [leftPlayer, rightPlayer]
      : [rightPlayer, leftPlayer]
  const viewportWidth = model.camera.viewportWidth || 960
  const maxGap = Math.max(160, viewportWidth - 180)
  const currentGap = playerB.pos.x - playerA.pos.x
  if (currentGap <= maxGap) return

  const overlap = currentGap - maxGap
  const shift = overlap / 2

  playerA.pos.x += shift
  playerB.pos.x -= shift
  playerA.oldPos.x = playerA.pos.x
  playerB.oldPos.x = playerB.pos.x

  if (playerA.velocity.x < 0) playerA.velocity.x = 0
  if (playerB.velocity.x > 0) playerB.velocity.x = 0
}
