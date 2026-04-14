import { TILE_SIZE } from "./game-state.js"

const PLAYER_DRAW_SIZE = 40
const BG_IMG_WIDTH = 256
const backgroundImages = [
  [loadBackgroundImage("background_solid_sky")],
  [loadBackgroundImage("background_clouds")],
  [
    loadBackgroundImage("background_fade_hills"),
    loadBackgroundImage("background_fade_trees"),
    loadBackgroundImage("background_fade_desert"),
    loadBackgroundImage("background_fade_mushrooms"),
  ],
  [loadBackgroundImage("background_solid_sky")],
]
const grassBlockImage = loadTileImage("terrain_grass_block")
const grassTopImage = loadTileImage("terrain_grass_block_top")
const grassTopLeftImage = loadTileImage("terrain_grass_block_top_left")
const grassTopRightImage = loadTileImage("terrain_grass_block_top_right")
const grassVerticalTopImage = loadTileImage("terrain_grass_vertical_top")
const terrainBlockImage = loadTileImage("terrain_grass_block_center")
/** @type {Record<string, HTMLImageElement>} */
const gemImages = {
  gem_blue: loadTileImage("gem_blue"),
  gem_green: loadTileImage("gem_green"),
  gem_red: loadTileImage("gem_red"),
  gem_yellow: loadTileImage("gem_yellow"),
}
const hudHeartImage = loadTileImage("hud_heart")
const hudHeartEmptyImage = loadTileImage("hud_heart_empty")
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
  updateCamera(model, view, width, height)
  const cameraOffsets = getCameraOffsets(
    model,
    view,
    width,
    height,
    worldWidth,
    worldHeight,
  )
  const { offsetX, offsetY } = cameraOffsets

  drawParallax(model, view)
  // ctx.fillStyle = model.world.background
  // ctx.fillRect(offsetX, offsetY, worldWidth, worldHeight)

  drawGround(model, view, offsetX, offsetY, worldWidth, worldHeight)
  drawObjects(model, view, offsetX, offsetY)

  for (const player of model.players) {
    const playerX = lerp(player.oldPos.x, player.pos.x, model.frameTime)
    const playerY = lerp(player.oldPos.y, player.pos.y, model.frameTime)
    drawPlayer(player, model, view, offsetX, offsetY, playerX, playerY)
  }

  drawHud(model, view, width, height)
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
 * @param {number} value
 * @param {number} min
 * @param {number} max
 */
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

/**
 * @param {import('./game-state.js').GameModel} model
 * @param {import('./game-state.js').GameView} view
 */
function drawParallax(model, view) {
  /** @type {number[][]} */
  backgroundImages.forEach((images, index) => {
    const y = index * BG_IMG_WIDTH - 365
    for (let i = 0, x = 0; x < view.ctx.canvas.width; i++, x += BG_IMG_WIDTH) {
      const image = images[i % images.length]
      if (image) view.ctx.drawImage(image, x - index * model.camera.x * 0.2, y)
    }
  })
}

/**
 * @param {import('./game-state.js').GameModel} model
 * @param {import('./game-state.js').GameView} view
 * @param {number} width
 * @param {number} height
 */
function updateCamera(model, view, width, height) {
  const viewportWorldWidth = width / view.scale
  const viewportWorldHeight = height / view.scale
  model.camera.viewportWidth = viewportWorldWidth
  model.camera.viewportHeight = viewportWorldHeight
  const desiredFocus = getPlayerFocus(model)
  const desiredCameraX = clamp(
    desiredFocus.x - viewportWorldWidth / 2,
    0,
    Math.max(0, model.world.width - viewportWorldWidth),
  )
  const desiredCameraY = clamp(
    desiredFocus.y - viewportWorldHeight / 2,
    0,
    Math.max(0, model.world.height - viewportWorldHeight),
  )

  model.camera.x = lerp(model.camera.x, desiredCameraX, 0.12)
  model.camera.y = lerp(model.camera.y, desiredCameraY, 0.12)
}

/**
 * @param {import('./game-state.js').GameModel} model
 * @param {import('./game-state.js').GameView} view
 * @param {number} width
 * @param {number} height
 * @param {number} worldWidth
 * @param {number} worldHeight
 */
function getCameraOffsets(model, view, width, height, worldWidth, worldHeight) {
  const centeredOffsetX = Math.max(0, (width - worldWidth) / 2)
  const centeredOffsetY = Math.max(0, (height - worldHeight) / 2)

  return {
    offsetX: centeredOffsetX - model.camera.x * view.scale,
    offsetY: centeredOffsetY - model.camera.y * view.scale,
  }
}

/**
 * @param {import('./game-state.js').GameModel} model
 */
function getPlayerFocus(model) {
  if (model.players.length === 0) {
    return {
      x: model.world.width / 2,
      y: model.world.height / 2,
    }
  }

  let totalX = 0
  let totalY = 0
  for (const player of model.players) {
    totalX +=
      lerp(player.oldPos.x, player.pos.x, model.frameTime) + player.size.x / 2
    totalY +=
      lerp(player.oldPos.y, player.pos.y, model.frameTime) + player.size.y / 2
  }

  return {
    x: totalX / model.players.length,
    y: totalY / model.players.length,
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
 * @param {import('./game-state.js').GameModel} model
 * @param {import('./game-state.js').GameView} view
 * @param {number} offsetX
 * @param {number} offsetY
 */
function drawObjects(model, view, offsetX, offsetY) {
  const level = model.levels[0]
  if (!level) return

  const ctx = view.ctx
  const drawSize = 26 * view.scale
  const fallbackGemImage = gemImages["gem_blue"]

  for (const object of level.objects) {
    if (object.kind !== "gem" || object.collected) continue

    const image = gemImages[object.sprite ?? "gem_blue"] ?? fallbackGemImage
    const objectX = offsetX + object.x * TILE_SIZE * view.scale
    const objectY = offsetY + object.y * TILE_SIZE * view.scale
    const drawX =
      objectX + (object.width * TILE_SIZE * view.scale - drawSize) / 2
    const drawY =
      objectY + (object.height * TILE_SIZE * view.scale - drawSize) / 2

    if (image?.complete) {
      ctx.drawImage(
        image,
        Math.round(drawX),
        Math.round(drawY),
        drawSize,
        drawSize,
      )
      continue
    }

    ctx.fillStyle = "#38bdf8"
    ctx.beginPath()
    ctx.arc(
      drawX + drawSize / 2,
      drawY + drawSize / 2,
      drawSize / 3,
      0,
      Math.PI * 2,
    )
    ctx.fill()
  }
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
 * @param {import('./game-state.js').GameModel} model
 * @param {import('./game-state.js').GameView} view
 * @param {number} width
 * @param {number} height
 */
function drawHud(model, view, width, height) {
  const ctx = view.ctx
  const panelWidth = Math.min(190, width / Math.max(1, model.players.length))
  const panelHeight = 54
  const margin = 12

  for (const player of model.players) {
    const panelX = margin + player.index * (panelWidth + margin)
    const panelY = height - panelHeight - margin

    ctx.save()
    ctx.fillStyle = "rgba(2, 6, 23, 0.72)"
    ctx.fillRect(panelX, panelY, panelWidth, panelHeight)
    ctx.strokeStyle = getPlayerLabelColor(player)
    ctx.lineWidth = 2
    ctx.strokeRect(panelX, panelY, panelWidth, panelHeight)

    ctx.fillStyle = "#e2e8f0"
    ctx.font = "12px monospace"
    ctx.textBaseline = "top"
    ctx.fillText(`P${player.index + 1}`, panelX + 10, panelY + 8)

    drawHudHearts(ctx, player, panelX + 10, panelY + 24)
    drawHudGems(ctx, player, panelX + 110, panelY + 22)
    ctx.restore()
  }
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {GameActorData} player
 * @param {number} x
 * @param {number} y
 */
function drawHudHearts(ctx, player, x, y) {
  const size = 16

  for (let i = 0; i < player.maxHearts; i++) {
    const image = i < player.hearts ? hudHeartImage : hudHeartEmptyImage
    const drawX = x + i * (size + 4)
    if (image.complete) {
      ctx.drawImage(image, drawX, y, size, size)
      continue
    }

    ctx.fillStyle = i < player.hearts ? "#ef4444" : "#475569"
    ctx.fillRect(drawX, y, size, size)
  }
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {GameActorData} player
 * @param {number} x
 * @param {number} y
 */
function drawHudGems(ctx, player, x, y) {
  const size = 16
  const hudGemImage = gemImages["gem_blue"]

  if (hudGemImage?.complete) {
    ctx.drawImage(hudGemImage, x, y, size, size)
  } else {
    ctx.fillStyle = "#38bdf8"
    ctx.fillRect(x, y, size, size)
  }

  ctx.fillStyle = "#f8fafc"
  ctx.font = "12px monospace"
  ctx.textBaseline = "middle"
  ctx.fillText(`${player.gems}`, x + size + 8, y + size / 2)
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
