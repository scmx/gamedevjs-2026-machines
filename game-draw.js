const TILE_SIZE = 48
const GROUND_Y = 72
const PLAYER_DRAW_SIZE = 40
const backgroundImages = [
  loadBackgroundImage("background_solid_sky"),
  loadBackgroundImage("background_clouds"),
  loadBackgroundImage("background_fade_hills"),
]
const grassTopImage = loadTileImage("terrain_grass_block_top")
const terrainBlockImage = loadTileImage("terrain_grass_block_center")
/** @type {Record<string, {
 *   idle: HTMLImageElement
 *   jump: HTMLImageElement
 *   walk_a: HTMLImageElement
 *   walk_b: HTMLImageElement
 * }>} */
const playerImages = {
  beige: {
    idle: loadCharacterImage("character_beige_idle"),
    jump: loadCharacterImage("character_beige_jump"),
    walk_a: loadCharacterImage("character_beige_walk_a"),
    walk_b: loadCharacterImage("character_beige_walk_b"),
  },
  green: {
    idle: loadCharacterImage("character_green_idle"),
    jump: loadCharacterImage("character_green_jump"),
    walk_a: loadCharacterImage("character_green_walk_a"),
    walk_b: loadCharacterImage("character_green_walk_b"),
  },
  pink: {
    idle: loadCharacterImage("character_pink_idle"),
    jump: loadCharacterImage("character_pink_jump"),
    walk_a: loadCharacterImage("character_pink_walk_a"),
    walk_b: loadCharacterImage("character_pink_walk_b"),
  },
  purple: {
    idle: loadCharacterImage("character_purple_idle"),
    jump: loadCharacterImage("character_purple_jump"),
    walk_a: loadCharacterImage("character_purple_walk_a"),
    walk_b: loadCharacterImage("character_purple_walk_b"),
  },
  yellow: {
    idle: loadCharacterImage("character_yellow_idle"),
    jump: loadCharacterImage("character_yellow_jump"),
    walk_a: loadCharacterImage("character_yellow_walk_a"),
    walk_b: loadCharacterImage("character_yellow_walk_b"),
  },
}

/**
 * @param {import('./game-state.js').GameModel} model
 * @param {import('./game-state.js').GameView} view
 */
export function draw(model, view) {
  const ctx = view.ctx
  const width = ctx.canvas.width / (window.devicePixelRatio || 1)
  const height = ctx.canvas.height / (window.devicePixelRatio || 1)
  clear(view, "#020617")

  const worldWidth = model.world.width * view.scale
  const worldHeight = model.world.height * view.scale
  const offsetX = (width - worldWidth) / 2
  const offsetY = (height - worldHeight) / 2

  drawParallax(model, view, offsetX, offsetY, worldWidth, worldHeight)
  // ctx.fillStyle = model.world.background
  // ctx.fillRect(offsetX, offsetY, worldWidth, worldHeight)

  drawGround(model, view, offsetX, offsetY, worldWidth, worldHeight)

  for (const player of model.players) {
    const playerX = lerp(player.oldPos.x, player.pos.x, model.frameTime)
    const playerY = lerp(player.oldPos.y, player.pos.y, model.frameTime)
    drawPlayer(player, model, view, offsetX, offsetY, playerX, playerY)
  }
}

/**
 * @param {import('./game-state.js').GameView} view
 * @param {string} color
 */
export function clear(view, color) {
  const ctx = view.ctx
  ctx.fillStyle = color
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
}

/**
 * @param {number} start
 * @param {number} end
 * @param {number} alpha
 */
export function lerp(start, end, alpha) {
  return start + (end - start) * alpha
}

/**
 * @param {import('./game-state.js').GameModel} model
 * @param {import('./game-state.js').GameView} view
 * @param {number} offsetX
 * @param {number} offsetY
 * @param {number} worldWidth
 * @param {number} worldHeight
 */
function drawParallax(model, view, offsetX, offsetY, worldWidth, worldHeight) {
  const ctx = view.ctx
  const leadPlayer = model.players[0]
  const focusX = leadPlayer
    ? lerp(leadPlayer.oldPos.x, leadPlayer.pos.x, model.frameTime)
    : 0
  const worldProgress = focusX / model.world.width
  const layers = [
    { image: backgroundImages[0], speed: 0, alpha: 1 },
    { image: backgroundImages[1], speed: 18, alpha: 0.75 },
    { image: backgroundImages[2], speed: 42, alpha: 0.95 },
  ]

  for (const layer of layers) {
    if (!layer.image?.complete) continue
    const image = layer.image
    const imageAspect = image.width / image.height
    const drawHeight = worldHeight
    const drawWidth = drawHeight * imageAspect
    const travel = Math.max(0, drawWidth - worldWidth)
    const drawX = offsetX - travel * worldProgress - layer.speed * worldProgress

    ctx.save()
    ctx.globalAlpha = layer.alpha
    ctx.drawImage(
      image,
      Math.round(drawX),
      Math.round(offsetY),
      Math.round(drawWidth),
      Math.round(drawHeight),
    )
    if (drawX + drawWidth < offsetX + worldWidth) {
      ctx.drawImage(
        image,
        Math.round(drawX + drawWidth - 1),
        Math.round(offsetY),
        Math.round(drawWidth),
        Math.round(drawHeight),
      )
    }
    ctx.restore()
  }
}

/**
 * @param {import('./game-state.js').GameModel} model
 * @param {import('./game-state.js').GameView} view
 * @param {number} offsetX
 * @param {number} offsetY
 * @param {number} worldWidth
 * @param {number} worldHeight
 */
function drawGround(model, view, offsetX, offsetY, worldWidth, worldHeight) {
  const ctx = view.ctx
  const tileSize = TILE_SIZE * view.scale
  const tileSpan = Math.ceil(tileSize) + 1
  const groundTop = offsetY + worldHeight - GROUND_Y * view.scale

  if (grassTopImage.complete) {
    for (let x = offsetX; x < offsetX + worldWidth + tileSize; x += tileSize) {
      ctx.drawImage(
        grassTopImage,
        Math.round(x),
        Math.round(groundTop),
        tileSpan,
        tileSpan,
      )
    }
  }

  if (terrainBlockImage.complete) {
    for (
      let y = groundTop + tileSize;
      y < offsetY + worldHeight + tileSize;
      y += tileSize
    ) {
      for (
        let x = offsetX;
        x < offsetX + worldWidth + tileSize;
        x += tileSize
      ) {
        ctx.drawImage(
          terrainBlockImage,
          Math.round(x),
          Math.round(y),
          tileSpan,
          tileSpan,
        )
      }
    }
    return
  }

  ctx.fillStyle = model.world.ground
  ctx.fillRect(offsetX, groundTop, worldWidth, GROUND_Y * view.scale)
}

/**
 * @param {GameActorData} player
 * @param {import('./game-state.js').GameModel} model
 * @param {import('./game-state.js').GameView} view
 * @param {number} offsetX
 * @param {number} offsetY
 * @param {number} playerX
 * @param {number} playerY
 */
function drawPlayer(player, model, view, offsetX, offsetY, playerX, playerY) {
  const ctx = view.ctx
  const image = getPlayerImage(player, model)
  const size = PLAYER_DRAW_SIZE * view.scale
  const drawX =
    offsetX + playerX * view.scale + (player.size.x * view.scale - size) / 2
  const drawY =
    offsetY + playerY * view.scale + player.size.y * view.scale - size

  if (!image.complete) {
    ctx.fillStyle = player.color
    ctx.fillRect(
      offsetX + playerX * view.scale,
      offsetY + playerY * view.scale,
      player.size.x * view.scale,
      player.size.y * view.scale,
    )
    return
  }

  ctx.save()
  if (player.velocity.x < -1) {
    ctx.translate(drawX + size, drawY)
    ctx.scale(-1, 1)
    ctx.drawImage(image, 0, 0, size, size)
  } else {
    ctx.drawImage(image, drawX, drawY, size, size)
  }
  ctx.restore()
}

/**
 * @param {GameActorData} player
 * @param {import('./game-state.js').GameModel} model
 */
function getPlayerImage(player, model) {
  const fallback = playerImages["beige"]
  const images = playerImages[player.skin] ?? fallback
  if (!images || !fallback) {
    return terrainBlockImage
  }
  if (!player.grounded) return images.jump
  if (Math.abs(player.velocity.x) < 1) return images.idle
  return Math.floor(model.simulationTime / 120) % 2 === 0
    ? images.walk_a
    : images.walk_b
}

/**
 * @param {string} name
 */
function loadCharacterImage(name) {
  return loadImage(
    `./kenney-new-platformer-pack/Sprites/Characters/Default/${name}.png`,
  )
}

/**
 * @param {string} name
 */
function loadBackgroundImage(name) {
  return loadImage(
    `./kenney-new-platformer-pack/Sprites/Backgrounds/Default/${name}.png`,
  )
}

/**
 * @param {string} name
 */
function loadTileImage(name) {
  return loadImage(
    `./kenney-new-platformer-pack/Sprites/Tiles/Default/${name}.png`,
  )
}

/**
 * @param {string} src
 */
function loadImage(src) {
  const image = document.createElement("img")
  image.decoding = "async"
  image.src = src
  return image
}
