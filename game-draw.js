import { TILE_SIZE } from "./game-state.js"

const PLAYER_DRAW_SIZE = 40
const backgroundImages = [
  loadBackgroundImage("background_solid_sky"),
  loadBackgroundImage("background_clouds"),
  loadBackgroundImage("background_fade_hills"),
]
const grassBlockImage = loadTileImage("terrain_grass_block")
const grassTopImage = loadTileImage("terrain_grass_block_top")
const grassTopLeftImage = loadTileImage("terrain_grass_block_top_left")
const grassTopRightImage = loadTileImage("terrain_grass_block_top_right")
const grassVerticalTopImage = loadTileImage("terrain_grass_vertical_top")
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
/** @type {Record<string, string>} */
const playerLabelColors = {
  beige: "#f59e0b",
  green: "#22c55e",
  pink: "#ec4899",
  purple: "#c084fc",
  yellow: "#eab308",
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
  const level = model.levels[0]
  const tileSize = TILE_SIZE * view.scale
  const tileSpan = Math.ceil(tileSize) + 1
  const terrainRows = level?.layers.terrain ?? []

  for (let tileY = 0; tileY < terrainRows.length; tileY++) {
    const row = terrainRows[tileY] ?? ""
    for (let tileX = 0; tileX < row.length; tileX++) {
      if (row[tileX] !== "1") continue

      const drawX = offsetX + tileX * tileSize
      const drawY = offsetY + tileY * tileSize
      const aboveRow = terrainRows[tileY - 1]
      const isTopTile = !aboveRow || aboveRow[tileX] !== "1"

      if (isTopTile) {
        const tileImage = getTerrainTopImage(terrainRows, tileX, tileY)
        if (tileImage.complete) {
          ctx.drawImage(
            tileImage,
            Math.round(drawX),
            Math.round(drawY),
            tileSpan,
            tileSpan,
          )
          continue
        }
      }

      if (terrainBlockImage.complete) {
        ctx.drawImage(
          terrainBlockImage,
          Math.round(drawX),
          Math.round(drawY),
          tileSpan,
          tileSpan,
        )
        continue
      }

      ctx.fillStyle = model.world.ground
      ctx.fillRect(drawX, drawY, tileSize, tileSize)
    }
  }

  if (terrainRows.length > 0) return

  ctx.fillStyle = model.world.ground
  ctx.fillRect(
    offsetX,
    offsetY + worldHeight - tileSize * 2,
    worldWidth,
    tileSize * 2,
  )
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
    drawPlayerLabel(player, view, offsetX, offsetY, playerX, playerY)
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
  drawPlayerLabel(player, view, offsetX, offsetY, playerX, playerY)
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
 * @param {GameActorData} player
 * @param {import('./game-state.js').GameView} view
 * @param {number} offsetX
 * @param {number} offsetY
 * @param {number} playerX
 * @param {number} playerY
 */
function drawPlayerLabel(player, view, offsetX, offsetY, playerX, playerY) {
  const ctx = view.ctx
  const centerX =
    offsetX + playerX * view.scale + (player.size.x * view.scale) / 2
  const labelY = offsetY + playerY * view.scale - 10 * view.scale

  ctx.save()
  ctx.font = `${Math.max(12, Math.round(14 * view.scale))}px monospace`
  ctx.textAlign = "center"
  ctx.textBaseline = "bottom"
  ctx.lineWidth = Math.max(2, 3 * view.scale)
  ctx.strokeStyle = "#020617"
  ctx.fillStyle = getPlayerLabelColor(player)
  ctx.strokeText(`P${player.index + 1}`, centerX, labelY)
  ctx.fillText(`P${player.index + 1}`, centerX, labelY)
  ctx.restore()
}

/**
 * @param {GameActorData} player
 * @returns {string}
 */
function getPlayerLabelColor(player) {
  return playerLabelColors[player.skin] ?? player.color
}

/**
 * @param {string[]} terrainRows
 * @param {number} tileX
 * @param {number} tileY
 * @returns {HTMLImageElement}
 */
function getTerrainTopImage(terrainRows, tileX, tileY) {
  const row = terrainRows[tileY] ?? ""
  const belowRow = terrainRows[tileY + 1] ?? ""
  const leftFilled = row[tileX - 1] === "1"
  const rightFilled = row[tileX + 1] === "1"
  const belowFilled = belowRow[tileX] === "1"

  if (!leftFilled && !rightFilled) {
    return belowFilled ? grassVerticalTopImage : grassBlockImage
  }
  if (!leftFilled) return grassTopLeftImage
  if (!rightFilled) return grassTopRightImage
  return grassTopImage
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
