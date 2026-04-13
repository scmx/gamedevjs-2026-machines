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
}

/**
 * @param {GameActorData} player
 * @param {import('./game-state.js').GameModel} model
 * @param {GameInput} input
 * @param {number} deltaTime
 */
export function updatePlayer(player, model, input, deltaTime) {
  const floorY = model.world.height - 72 - player.size.y

  player.oldPos.x = player.pos.x
  player.oldPos.y = player.pos.y

  const axisX = Number(input.right) - Number(input.left)
  if (input.jump && player.grounded) {
    player.velocity.y = -model.jumpSpeed
    player.grounded = false
  }

  player.velocity.x = axisX * player.speed
  player.velocity.y += model.gravity * deltaTime
  player.pos.x += player.velocity.x * deltaTime
  player.pos.y += player.velocity.y * deltaTime

  player.pos.x = clamp(player.pos.x, 0, model.world.width - player.size.x)
  player.pos.y = clamp(player.pos.y, 0, floorY)
  player.grounded = false
  if (player.pos.y >= floorY) {
    player.velocity.y = 0
    player.grounded = true
  }
}

const EMPTY_INPUT = Object.freeze({
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
