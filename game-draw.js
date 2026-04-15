import { EDITOR_PLACEABLES, getEditorFocusWorld } from "./editor-init.js"
import { TILE_SIZE } from "./game-state.js"

/** @type {string[]} */
const imagePathsUsed = []
export function getImagePathsUsed() {
  return imagePathsUsed
}

const PLAYER_DRAW_SIZE = 40
const BG_IMG_WIDTH = 256
const backgroundImages = [
  [loadBackgroundImage("background_clouds")],
  [
    loadBackgroundImage("background_fade_hills"),
    loadBackgroundImage("background_fade_trees"),
    loadBackgroundImage("background_fade_desert"),
    loadBackgroundImage("background_fade_mushrooms"),
  ],
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
/** @type {Record<string, HTMLImageElement>} */
const keyImages = {
  key_blue: loadTileImage("key_blue"),
  key_green: loadTileImage("key_green"),
  key_red: loadTileImage("key_red"),
  key_yellow: loadTileImage("key_yellow"),
}
/** @type {Record<string, HTMLImageElement>} */
const lockImages = {
  lock_blue: loadTileImage("lock_blue"),
  lock_green: loadTileImage("lock_green"),
  lock_red: loadTileImage("lock_red"),
  lock_yellow: loadTileImage("lock_yellow"),
}
/** @type {Record<string, HTMLImageElement>} */
const lockWallImages = {
  blue: loadTileImage("block_blue"),
  green: loadTileImage("block_green"),
  red: loadTileImage("block_red"),
  yellow: loadTileImage("block_yellow"),
}
/** @type {Record<string, HTMLImageElement>} */
const hudKeyImages = {
  blue: loadTileImage("hud_key_blue"),
  green: loadTileImage("hud_key_green"),
  red: loadTileImage("hud_key_red"),
  yellow: loadTileImage("hud_key_yellow"),
}
const hudHeartImage = loadTileImage("hud_heart")
const hudHeartEmptyImage = loadTileImage("hud_heart_empty")
/** Individual exports from spritesheet-tiles-default.xml (64×64 SubTexture entries) */
const doorClosedImage = loadTileImage("door_closed")
const doorClosedTopImage = loadTileImage("door_closed_top")
const doorOpenImage = loadTileImage("door_open")
const doorOpenTopImage = loadTileImage("door_open_top")
const ladderTopImage = loadTileImage("ladder_top")
const ladderMiddleImage = loadTileImage("ladder_middle")
const ladderBottomImage = loadTileImage("ladder_bottom")
/** @type {HTMLCanvasElement | null} */
let terrainCacheCanvas = null
/** @type {string | null} */
let terrainCacheKey = null
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
  const width = view.ctx.tiles.canvas.width / (window.devicePixelRatio || 1)
  const height = view.ctx.tiles.canvas.height / (window.devicePixelRatio || 1)
  clear(view.ctx.back, "#020617")
  clear(view.ctx.tiles)
  clear(view.ctx.objects)

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

  drawParallax(model, view, offsetX, offsetY)
  // ctx.fillStyle = model.world.background
  // ctx.fillRect(offsetX, offsetY, worldWidth, worldHeight)

  drawGround(model, view, width, height, worldWidth, worldHeight)
  drawObjects(model, view, offsetX, offsetY)

  for (const player of model.players) {
    const playerX = lerp(player.oldPos.x, player.pos.x, model.frameTime)
    const playerY = lerp(player.oldPos.y, player.pos.y, model.frameTime)
    drawPlayer(player, model, view, offsetX, offsetY, playerX, playerY)
  }

  drawHud(model, view, width, height)
  if (model.editorMode) {
    drawEditorOverlay(model, view, width, height, offsetX, offsetY)
  }
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} [color]
 */
export function clear(ctx, color) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  if (!color) return

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

  model.camera.x = clamp(
    lerp(model.camera.x, desiredCameraX, 0.12),
    0,
    Math.max(0, model.world.width - viewportWorldWidth),
  )
  model.camera.y = clamp(
    lerp(model.camera.y, desiredCameraY, 0.12),
    0,
    Math.max(0, model.world.height - viewportWorldHeight),
  )
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
  if (model.editorMode) {
    return getEditorFocusWorld(model)
  }

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
 */
function drawParallax(model, view, offsetX, offsetY) {
  const ctx = view.ctx.back
  ctx.fillStyle = "#c3e3ff"
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)

  // const centeredOffsetX = Math.max(0, (width - worldWidth) / 2)
  // const centeredOffsetY = Math.max(0, (height - worldHeight) / 2)
  const size = Math.floor(BG_IMG_WIDTH * view.scale)
  const viewportHeight = ctx.canvas.height
  const cloudHeight = size
  const fadeHeight = size
  const skyHeight = Math.max(0, Math.round(viewportHeight * 0.16))
  const cloudY = Math.floor(offsetY - cloudHeight * 0.5)
  const fadeY = cloudY + cloudHeight

  const bands = [
    {
      images: backgroundImages[0],
      y: cloudY,
      parallax: 0.3,
      height: cloudHeight,
    },
    {
      images: backgroundImages[1],
      y: fadeY,
      parallax: 0.6,
      height: fadeHeight,
    },
  ]

  for (const band of bands) {
    const images = band.images
    if (!images) continue
    const scrollX = Math.floor(model.camera.x * band.parallax)
    for (let i = -1, x = -size; x < ctx.canvas.width + size; i++, x += size) {
      const image =
        images[((i % images.length) + images.length) % images.length]
      if (!image) continue
      ctx.drawImage(image, x - scrollX, band.y, size, band.height)
    }
  }
}

/**
 * @param {import('./game-state.js').GameModel} model
 * @param {import('./game-state.js').GameView} view
 * @param {number} width
 * @param {number} height
 * @param {number} worldWidth
 * @param {number} worldHeight
 */
function drawGround(model, view, width, height, worldWidth, worldHeight) {
  const ctx = view.ctx.tiles
  const level = model.levels[0]
  const tileSize = TILE_SIZE * view.scale
  if (!level) return
  const terrainRows = level.layers.terrain ?? []

  if (terrainRows.length === 0) {
    const centeredOffsetX = Math.max(0, (width - worldWidth) / 2)
    const centeredOffsetY = Math.max(0, (height - worldHeight) / 2)
    ctx.fillStyle = model.world.ground
    ctx.fillRect(
      centeredOffsetX,
      centeredOffsetY + worldHeight - tileSize * 2,
      worldWidth,
      tileSize * 2,
    )
    return
  }

  const cache = getTerrainCache(level)
  if (!cache) return
  const centeredOffsetX = Math.max(0, (width - worldWidth) / 2)
  const centeredOffsetY = Math.max(0, (height - worldHeight) / 2)
  const drawX = Math.round(centeredOffsetX - model.camera.x * view.scale)
  const drawY = Math.round(centeredOffsetY - model.camera.y * view.scale)

  ctx.drawImage(
    cache,
    drawX,
    drawY,
    Math.round(cache.width * view.scale),
    Math.round(cache.height * view.scale),
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

  const ctx = view.ctx.objects
  const tileSize = TILE_SIZE * view.scale
  const tileSpan = Math.ceil(tileSize) + 1
  const fallbackGemImage = gemImages["gem_blue"]
  const fallbackKeyImage = keyImages["key_blue"]
  const fallbackLockImage = lockImages["lock_blue"]
  const bounceDistance = 6 * view.scale
  let allColorLocksCleared = true
  for (const o of level.objects) {
    if (o.kind === "lock" && !o.collected) {
      allColorLocksCleared = false
      break
    }
  }

  for (const object of level.objects) {
    if (object.collected) continue

    if (object.kind === "ladder") {
      const objectX = offsetX + object.x * TILE_SIZE * view.scale
      const drawColumnX = objectX + (object.width * tileSize - tileSize) / 2
      const topTileRow = object.y - (object.height - 1)
      for (let row = 0; row < object.height; row++) {
        const tileRow = topTileRow + row
        const drawY = offsetY + tileRow * TILE_SIZE * view.scale
        const image =
          row === 0
            ? ladderTopImage
            : row === object.height - 1
              ? ladderBottomImage
              : ladderMiddleImage
        if (image?.complete) {
          ctx.drawImage(
            image,
            Math.round(drawColumnX),
            Math.round(drawY),
            tileSpan,
            tileSpan,
          )
        } else {
          ctx.fillStyle = "#a16207"
          ctx.fillRect(
            Math.round(drawColumnX),
            Math.round(drawY),
            tileSpan,
            tileSpan,
          )
        }
      }
      continue
    }

    if (object.kind === "exit_door") {
      const objectX = offsetX + object.x * TILE_SIZE * view.scale
      const drawColumnX = objectX + (object.width * tileSize - tileSize) / 2
      const topTileRow = object.y - (object.height - 1)
      const unlocked = allColorLocksCleared

      for (let row = 0; row < object.height; row++) {
        const tileRow = topTileRow + row
        const drawY = offsetY + tileRow * TILE_SIZE * view.scale
        const image = unlocked
          ? row === 0
            ? doorOpenTopImage
            : doorOpenImage
          : row === 0
            ? doorClosedTopImage
            : doorClosedImage

        if (image?.complete) {
          ctx.drawImage(
            image,
            Math.round(drawColumnX),
            Math.round(drawY),
            tileSpan,
            tileSpan,
          )
        } else {
          ctx.fillStyle = unlocked
            ? "rgba(34, 197, 94, 0.45)"
            : "rgba(15, 23, 42, 0.92)"
          ctx.fillRect(
            Math.round(drawColumnX),
            Math.round(drawY),
            tileSpan,
            tileSpan,
          )
        }
      }
      continue
    }

    const image =
      object.kind === "lock"
        ? (lockImages[object.sprite ?? "lock_blue"] ?? fallbackLockImage)
        : object.kind === "key"
          ? (keyImages[object.sprite ?? "key_blue"] ?? fallbackKeyImage)
          : (gemImages[object.sprite ?? "gem_blue"] ?? fallbackGemImage)
    const spriteColor = object.sprite?.split("_")[1] ?? "blue"
    const objectX = offsetX + object.x * TILE_SIZE * view.scale
    const objectY = offsetY + object.y * TILE_SIZE * view.scale
    const bounceOffset =
      object.kind === "lock"
        ? 0
        : Math.sin(model.elapsed * 3 + object.x * 0.8) * bounceDistance
    const drawX = objectX + (object.width * tileSize - tileSize) / 2
    const drawY =
      object.kind === "lock"
        ? objectY - bounceOffset
        : objectY + (object.height * tileSize - tileSize) / 2 - bounceOffset

    if (image?.complete) {
      if (object.kind === "lock") {
        const wallImage = lockWallImages[spriteColor] ?? lockWallImages["blue"]
        if (wallImage?.complete) {
          for (let i = 1; i <= 2; i++) {
            const wallY = objectY - i * tileSize
            ctx.drawImage(
              wallImage,
              Math.round(objectX),
              Math.round(wallY),
              tileSpan,
              tileSpan,
            )
          }
        }
      }

      ctx.drawImage(
        image,
        Math.round(drawX),
        Math.round(drawY),
        tileSpan,
        tileSpan,
      )
      continue
    }

    ctx.fillStyle =
      object.kind === "lock"
        ? "#f59e0b"
        : object.kind === "key"
          ? "#facc15"
          : "#38bdf8"
    ctx.beginPath()
    ctx.arc(
      drawX + tileSize / 2,
      drawY + tileSize / 2,
      tileSize / 3,
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
  const ctx = view.ctx.objects
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
  if (player.onLadder) return images.idle
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
  const ctx = view.ctx.objects
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
  const ctx = view.ctx.objects
  const s = view.scale
  const panelWidth = Math.min(
    190 * s,
    width / Math.max(1, model.players.length),
  )
  const panelHeight = 76 * s
  const margin = 12 * s

  for (const player of model.players) {
    const panelX = margin + player.index * (panelWidth + margin)
    const panelY = height - panelHeight - margin

    ctx.save()
    ctx.fillStyle = "rgba(2, 6, 23, 0.72)"
    ctx.fillRect(panelX, panelY, panelWidth, panelHeight)
    ctx.strokeStyle = getPlayerLabelColor(player)
    ctx.lineWidth = Math.max(1, 2 * s)
    ctx.strokeRect(panelX, panelY, panelWidth, panelHeight)

    ctx.fillStyle = "#e2e8f0"
    ctx.font = `${Math.max(10, Math.round(12 * s))}px monospace`
    ctx.textBaseline = "top"
    ctx.fillText(`P${player.index + 1}`, panelX + 10 * s, panelY + 8 * s)

    drawHudHearts(ctx, player, panelX + 10 * s, panelY + 24 * s, s)
    drawHudGems(ctx, player, panelX + 110 * s, panelY + 22 * s, s)
    drawHudKeys(ctx, player, panelX + 10 * s, panelY + 48 * s, s)
    ctx.restore()
  }
}

/**
 * @param {import('./game-state.js').GameModel} model
 * @param {import('./game-state.js').GameView} view
 * @param {number} width
 * @param {number} height
 * @param {number} offsetX
 * @param {number} offsetY
 */
function drawEditorOverlay(model, view, width, _height, offsetX, offsetY) {
  const ctx = view.ctx.objects
  const s = view.scale
  const ts = TILE_SIZE * s
  const px = offsetX + model.editorTileX * ts
  const py = offsetY + model.editorTileY * ts

  ctx.save()
  ctx.strokeStyle = "#38bdf8"
  ctx.lineWidth = Math.max(2, 2 * s)
  ctx.setLineDash([6 * s, 4 * s])
  ctx.strokeRect(Math.round(px), Math.round(py), Math.ceil(ts), Math.ceil(ts))
  ctx.setLineDash([])

  const thing = EDITOR_PLACEABLES[model.editorThingIndex]
  const label = thing?.label ?? "?"
  const slot = model.editorThingIndex + 1
  const total = EDITOR_PLACEABLES.length
  const barW = Math.min(340 * s, width - 24 * s)
  const barH = 34 * s
  const bx = (width - barW) / 2
  const by = 10 * s

  ctx.fillStyle = "rgba(2, 6, 23, 0.88)"
  ctx.fillRect(bx, by, barW, barH)
  ctx.strokeStyle = "#38bdf8"
  ctx.lineWidth = Math.max(1, 2 * s)
  ctx.strokeRect(bx, by, barW, barH)

  ctx.fillStyle = "#e2e8f0"
  ctx.font = `${Math.max(10, Math.round(12 * s))}px monospace`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(
    `EDITOR  ${label}  (${slot}/${total})  tile ${model.editorTileX},${model.editorTileY}`,
    width / 2,
    by + barH / 2,
  )
  ctx.restore()
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {GameActorData} player
 * @param {number} x
 * @param {number} y
 * @param {number} scale
 */
function drawHudHearts(ctx, player, x, y, scale) {
  const size = 16 * scale
  const gap = 4 * scale

  for (let i = 0; i < player.maxHearts; i++) {
    const image = i < player.hearts ? hudHeartImage : hudHeartEmptyImage
    const drawX = x + i * (size + gap)
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
 * @param {number} scale
 */
function drawHudGems(ctx, player, x, y, scale) {
  const size = 16 * scale
  const hudGemImage = gemImages["gem_blue"]

  if (hudGemImage?.complete) {
    ctx.drawImage(hudGemImage, x, y, size, size)
  } else {
    ctx.fillStyle = "#38bdf8"
    ctx.fillRect(x, y, size, size)
  }

  ctx.fillStyle = "#f8fafc"
  ctx.font = `${Math.max(10, Math.round(12 * scale))}px monospace`
  ctx.textBaseline = "middle"
  ctx.fillText(`${player.gems}`, x + size + 8 * scale, y + size / 2)
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {GameActorData} player
 * @param {number} x
 * @param {number} y
 * @param {number} scale
 */
function drawHudKeys(ctx, player, x, y, scale) {
  const keyColors = /** @type {const} */ (["blue", "green", "red", "yellow"])
  const size = 14 * scale
  const gap = 8 * scale

  for (let i = 0; i < keyColors.length; i++) {
    const keyColor = keyColors[i]
    if (!keyColor) continue
    const image = hudKeyImages[keyColor]
    const drawX = x + i * (size + gap)

    ctx.save()
    ctx.globalAlpha = player.keys[keyColor] ? 1 : 0.25
    if (image?.complete) {
      ctx.drawImage(image, drawX, y, size, size)
    } else {
      ctx.fillStyle = player.keys[keyColor] ? "#f8fafc" : "#475569"
      ctx.fillRect(drawX, y, size, size)
    }
    ctx.restore()
  }
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
 * @param {GameLevel} level
 * @returns {HTMLCanvasElement | null}
 */
function getTerrainCache(level) {
  const cacheKey = `${level.width}x${level.height}:${level.generatedFrom.seed}:${level.generatedFrom.version}`
  if (terrainCacheCanvas && terrainCacheKey === cacheKey) {
    return terrainCacheCanvas
  }

  const canvas = document.createElement("canvas")
  canvas.width = level.width * TILE_SIZE
  canvas.height = level.height * TILE_SIZE
  const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext("2d"))
  if (!ctx) return null
  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  const terrainRows = level.layers.terrain ?? []
  for (let tileY = 0; tileY < terrainRows.length; tileY++) {
    const row = terrainRows[tileY] ?? ""
    for (let tileX = 0; tileX < row.length; tileX++) {
      if (row[tileX] !== "1") continue

      const drawX = tileX * TILE_SIZE
      const drawY = tileY * TILE_SIZE
      const aboveRow = terrainRows[tileY - 1]
      const isTopTile = !aboveRow || aboveRow[tileX] !== "1"
      const tileImage = isTopTile
        ? getTerrainTopImage(terrainRows, tileX, tileY)
        : terrainBlockImage

      if (tileImage.complete) {
        ctx.drawImage(tileImage, drawX, drawY, TILE_SIZE + 1, TILE_SIZE + 1)
      } else {
        ctx.fillStyle = "#1e293b"
        ctx.fillRect(drawX, drawY, TILE_SIZE, TILE_SIZE)
      }
    }
  }

  terrainCacheCanvas = canvas
  terrainCacheKey = cacheKey
  return terrainCacheCanvas
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
  imagePathsUsed.push(src)
  const image = document.createElement("img")
  image.decoding = "async"
  image.src = src
  return image
}
