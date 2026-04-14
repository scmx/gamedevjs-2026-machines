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

  resolveLocks(model)
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

  resolveTerrainCollisions(model, player)
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
 */
function resolveTerrainCollisions(model, player) {
  const level = model.levels[0]
  if (!level?.layers.terrain.length) {
    player.pos.x = clamp(player.pos.x, 0, model.world.width - player.size.x)
    const floorY = model.world.height - 96 - player.size.y
    player.pos.y = clamp(player.pos.y, 0, floorY)
    player.grounded = player.pos.y >= floorY
    if (player.grounded) player.velocity.y = 0
    return
  }

  const tileSize = model.world.width / level.width
  const terrainRows = level.layers.terrain
  const minTileX = clamp(
    Math.floor(player.pos.x / tileSize) - 1,
    0,
    level.width - 1,
  )
  const maxTileX = clamp(
    Math.floor((player.pos.x + player.size.x) / tileSize) + 1,
    0,
    level.width - 1,
  )
  const minTileY = clamp(
    Math.floor(player.pos.y / tileSize) - 1,
    0,
    terrainRows.length - 1,
  )
  const maxTileY = clamp(
    Math.floor((player.pos.y + player.size.y) / tileSize) + 1,
    0,
    terrainRows.length - 1,
  )

  player.grounded = false

  for (let tileY = minTileY; tileY <= maxTileY; tileY++) {
    const row = terrainRows[tileY]
    if (!row) continue

    for (let tileX = minTileX; tileX <= maxTileX; tileX++) {
      if (row[tileX] !== "1") continue

      const tileLeft = tileX * tileSize
      const tileRight = tileLeft + tileSize
      const tileTop = tileY * tileSize
      const tileBottom = tileTop + tileSize

      if (!isOverlappingRect(player, tileLeft, tileTop, tileSize, tileSize))
        continue

      const overlapLeft = player.pos.x + player.size.x - tileLeft
      const overlapRight = tileRight - player.pos.x
      const overlapTop = player.pos.y + player.size.y - tileTop
      const overlapBottom = tileBottom - player.pos.y
      const minOverlap = Math.min(
        overlapLeft,
        overlapRight,
        overlapTop,
        overlapBottom,
      )

      if (minOverlap === overlapTop) {
        player.pos.y = tileTop - player.size.y
        if (player.velocity.y > 0) player.velocity.y = 0
        player.grounded = true
        continue
      }

      if (minOverlap === overlapBottom) {
        player.pos.y = tileBottom
        if (player.velocity.y < 0) player.velocity.y = 0
        continue
      }

      if (minOverlap === overlapLeft) {
        player.pos.x = tileLeft - player.size.x
        if (player.velocity.x > 0) player.velocity.x = 0
        continue
      }

      player.pos.x = tileRight
      if (player.velocity.x < 0) player.velocity.x = 0
    }
  }

  player.pos.x = clamp(player.pos.x, 0, model.world.width - player.size.x)
  player.pos.y = clamp(player.pos.y, 0, model.world.height - player.size.y)
}

/**
 * @param {GameActorData} player
 * @param {number} left
 * @param {number} top
 * @param {number} width
 * @param {number} height
 * @returns {boolean}
 */
function isOverlappingRect(player, left, top, width, height) {
  return (
    player.pos.x < left + width &&
    player.pos.x + player.size.x > left &&
    player.pos.y < top + height &&
    player.pos.y + player.size.y > top
  )
}

/**
 * @param {import('./game-state.js').GameModel} model
 */
function collectPickups(model) {
  const level = model.levels[0]
  if (!level) return

  for (const object of level.objects) {
    if (object.collected || object.kind === "lock") continue

    for (const player of model.players) {
      if (!isOverlapping(player, object)) continue
      object.collected = true
      if (object.kind === "gem") {
        player.gems += 1
      } else if (object.kind === "key") {
        const keyColor = object.sprite?.replace("key_", "")
        if (keyColor) {
          player.keys[keyColor] = true
        }
      }
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
 * @param {import('./game-state.js').GameModel} model
 */
function resolveLocks(model) {
  const level = model.levels[0]
  if (!level) return

  for (const object of level.objects) {
    if (object.kind !== "lock" || object.collected) continue

    for (const player of model.players) {
      if (!isOverlapping(player, object)) continue

      const keyColor = object.sprite?.replace("lock_", "")
      if (keyColor && player.keys[keyColor]) {
        player.keys[keyColor] = false
        object.collected = true
        continue
      }

      resolveSolidOverlap(player, object)
    }
  }
}

/**
 * @param {GameActorData} player
 * @param {GameLevelObject} object
 */
function resolveSolidOverlap(player, object) {
  const objectX = object.x * TILE_SIZE
  const objectWidth = object.width * TILE_SIZE
  const objectBottomY = object.y * TILE_SIZE
  const objectTopY = objectBottomY - (object.height - 1) * TILE_SIZE
  const objectHeight = object.height * TILE_SIZE
  const playerCenterY = player.pos.y + player.size.y / 2
  const objectCenterY = objectTopY + objectHeight / 2
  const overlapLeft = player.pos.x + player.size.x - objectX
  const overlapRight = objectX + objectWidth - player.pos.x
  const overlapTop = player.pos.y + player.size.y - objectTopY
  const overlapBottom = objectTopY + objectHeight - player.pos.y
  const minOverlap = Math.min(
    overlapLeft,
    overlapRight,
    overlapTop,
    overlapBottom,
  )

  if (minOverlap === overlapLeft) {
    player.pos.x = objectX - player.size.x
    if (player.velocity.x > 0) player.velocity.x = 0
    return
  }

  if (minOverlap === overlapRight) {
    player.pos.x = objectX + objectWidth
    if (player.velocity.x < 0) player.velocity.x = 0
    return
  }

  if (minOverlap === overlapTop || playerCenterY < objectCenterY) {
    player.pos.y = objectTopY - player.size.y
    if (player.velocity.y > 0) player.velocity.y = 0
    player.grounded = true
    return
  }

  if (minOverlap === overlapBottom || playerCenterY >= objectCenterY) {
    player.pos.y = objectTopY + objectHeight
    if (player.velocity.y < 0) player.velocity.y = 0
  }
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
