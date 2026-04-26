import { EDITOR_BLOCK_VARIANTS } from "./editor-block-variants.js"
import { EDITOR_BRICK_VARIANTS } from "./editor-brick-variants.js"
import { EDITOR_COIN_VARIANTS } from "./editor-coin-variants.js"
import {
  EDITOR_BRIDGE_VARIANTS,
  EDITOR_ROCK_VARIANTS,
  EDITOR_ROPE_VARIANTS,
} from "./editor-decor-variants.js"
import { EDITOR_HAZARD_VARIANTS } from "./editor-hazard-variants.js"
import { EDITOR_PLACEABLES } from "./editor-placeables.js"
import {
  EDITOR_COLORS,
  getEditorFocusWorld,
} from "./editor-init.js"
import { INTERACTIVE_BLOCK_KINDS } from "./game-entities.js"
import { TILE_SIZE } from "./game-state.js"
import { FLUID_LAVA, getFluidAtTile, isFluidChar } from "./terrain-fluid.js"
import { biomeToChar, charToBiome, TERRAIN_BIOMES } from "./terrain-biome.js"

/** @type {string[]} */
const imagePathsUsed = []
export function getImagePathsUsed() {
  return imagePathsUsed
}

const PLAYER_DRAW_SIZE = 40

/**
 * Conveyor arrow: layout is defined for a 64×64 reference tile; all values are
 * fractions of the actual bitmap size so 128×128 or other sizes still work.
 * Ignore 17px / use 30px middle / ignore 17px; +2px pad into the inner band for the
 * animated grab.
 */
const CONVEYOR_REF_PX = 64
const CONVEYOR_EDGE_FRAC = 17 / CONVEYOR_REF_PX
const CONVEYOR_MID_FRAC = 30 / CONVEYOR_REF_PX
const CONVEYOR_PAD_FRAC = 2 / CONVEYOR_REF_PX
/** Dest-pixel nudge: overlay was 1px too far left and 1px past on the right. */
const CONVEYOR_OVERLAY_DEST_SHIFT_X = 1
const CONVEYOR_OVERLAY_DEST_SHRINK_W = 2

/**
 * @param {CanvasImageSource} src
 * @returns {{ w: number, h: number }}
 */
function canvasImageBitmapSize(src) {
  if (!src) return { w: 0, h: 0 }
  const o = /** @type {{ naturalWidth?: number, naturalHeight?: number, width?: number, height?: number }} */ (
    src
  )
  if (typeof o.naturalWidth === "number" && o.naturalWidth > 0) {
    return {
      w: o.naturalWidth,
      h: typeof o.naturalHeight === "number" ? o.naturalHeight : 0,
    }
  }
  if (typeof o.width === "number" && o.width > 0) {
    return {
      w: o.width,
      h: typeof o.height === "number" ? o.height : 0,
    }
  }
  return { w: 0, h: 0 }
}

/**
 * After the full conveyor sprite: mask the static arrow (inner band), then step a
 * grab of that band (+2px pad in ref space) through three horizontal slots.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {CanvasImageSource} conveyorImage
 * @param {number} left
 * @param {number} top
 * @param {number} width - full tile width (dest)
 * @param {number} height
 * @param {number} elapsed
 * @param {boolean} spriteFlipped - matches horizontal flip used for the full tile draw
 */
function drawConveyorBeltArrowOverlay(
  ctx,
  conveyorImage,
  left,
  top,
  width,
  height,
  elapsed,
  spriteFlipped,
) {
  const { w: iw, h: ih } = canvasImageBitmapSize(conveyorImage)
  if (!iw || !ih) return

  const w = width

  const sxInner = iw * CONVEYOR_EDGE_FRAC
  const syInner = ih * CONVEYOR_EDGE_FRAC
  const swInner = iw * CONVEYOR_MID_FRAC
  const shInner = ih * CONVEYOR_MID_FRAC

  const sxGrab = Math.max(0, sxInner - iw * CONVEYOR_PAD_FRAC)
  const syGrab = Math.max(0, syInner - ih * CONVEYOR_PAD_FRAC)
  const swGrab = Math.min(iw - sxGrab, swInner + 2 * iw * CONVEYOR_PAD_FRAC)
  const shGrab = Math.min(ih - syGrab, shInner + 2 * ih * CONVEYOR_PAD_FRAC)

  const stripLeft = left + w * CONVEYOR_EDGE_FRAC + CONVEYOR_OVERLAY_DEST_SHIFT_X
  const stripW = Math.max(
    1,
    w * CONVEYOR_MID_FRAC - CONVEYOR_OVERLAY_DEST_SHRINK_W,
  )
  const rowTop = top + height * CONVEYOR_EDGE_FRAC
  const rowH = height * CONVEYOR_MID_FRAC

  /** Hide baked-in arrow in the inner 17+30+17 band (mask only the 30 middle). */
  ctx.fillStyle = "rgb(72, 71, 87)"
  ctx.fillRect(
    Math.round(stripLeft),
    Math.round(rowTop),
    Math.round(stripW),
    Math.round(rowH),
  )

  const dw = w * (swGrab / iw)
  const dh = height * (shGrab / ih)
  const dy = top + height * (syGrab / ih)

  /** Horizontal anchor within the middle strip (0 … 1): center → right → left. */
  const xFrac = [0.5, 0.78, 0.22]
  const rate = 3.8
  const step = Math.floor(elapsed * rate * (spriteFlipped ? -1 : 1))
  const frame = ((step % 3) + 3) % 3
  const cx = stripLeft + stripW * (xFrac[frame] ?? 0.5)
  const dx = cx - dw / 2

  /** Clip: middle row with a little horizontal slack for the sliding grab. */
  const clipPadX = w * (6 / CONVEYOR_REF_PX)
  ctx.save()
  ctx.beginPath()
  ctx.rect(
    stripLeft - clipPadX,
    rowTop,
    stripW + 2 * clipPadX,
    rowH,
  )
  ctx.clip()

  if (spriteFlipped) {
    ctx.drawImage(
      conveyorImage,
      sxGrab,
      syGrab,
      swGrab,
      shGrab,
      Math.round(dx + dw),
      Math.round(dy),
      -Math.round(dw),
      Math.round(dh),
    )
  } else {
    ctx.drawImage(
      conveyorImage,
      sxGrab,
      syGrab,
      swGrab,
      shGrab,
      Math.round(dx),
      Math.round(dy),
      Math.round(dw),
      Math.round(dh),
    )
  }

  ctx.restore()
}
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
/**
 * @param {string} biome
 */
function loadBiomeTileSet(biome) {
  /** @param {string} n */
  const o = (n) => loadTileImage(`terrain_${biome}_${n}`)
  return {
    block: o("block"),
    top: o("block_top"),
    topLeft: o("block_top_left"),
    topRight: o("block_top_right"),
    bottom: o("block_bottom"),
    bottomLeft: o("block_bottom_left"),
    bottomRight: o("block_bottom_right"),
    left: o("block_left"),
    right: o("block_right"),
    center: o("block_center"),
    hLeft: o("horizontal_left"),
    hMid: o("horizontal_middle"),
    hRight: o("horizontal_right"),
    vTop: o("vertical_top"),
    vMid: o("vertical_middle"),
    vBottom: o("vertical_bottom"),
  }
}

/** @type {Record<string, ReturnType<typeof loadBiomeTileSet>>} */
const BIOME_TILES = {}
for (const b of TERRAIN_BIOMES) {
  BIOME_TILES[b] = loadBiomeTileSet(b)
}

const terrainBlockImage =
  BIOME_TILES["grass"]?.center ?? loadTileImage("terrain_grass_block_center")
const hillTopImage = loadTileImage("hill_top")
const hillTopSmileImage = loadTileImage("hill_top_smile")
/** Wall-clock-ish: show plain top only in first ~0.4s of each 30s cycle; rest is smile. */
const HILL_FACE_CYCLE_MS = 30000
const HILL_PLAIN_FACE_MS = 400

/**
 * @param {import('./game-state.js').GameModel} model
 * @returns {HTMLImageElement}
 */
function getHillFaceImage(model) {
  const t = model.simulationTime
  if (t % HILL_FACE_CYCLE_MS < HILL_PLAIN_FACE_MS) return hillTopImage
  return hillTopSmileImage
}
const waterFluidImage = loadTileImage("water")
const lavaFluidImage = loadTileImage("lava")
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
const hudKeyImages = {
  blue: loadTileImage("hud_key_blue"),
  green: loadTileImage("hud_key_green"),
  red: loadTileImage("hud_key_red"),
  yellow: loadTileImage("hud_key_yellow"),
}
const hudHeartImage = loadTileImage("hud_heart")
const hudHeartHalfImage = loadTileImage("hud_heart_half")
const hudHeartEmptyImage = loadTileImage("hud_heart_empty")
const hudCoinImage = loadTileImage("hud_coin")
/** Individual exports from spritesheet-tiles-default.xml (64×64 SubTexture entries) */
const doorClosedImage = loadTileImage("door_closed")
const doorClosedTopImage = loadTileImage("door_closed_top")
const doorOpenImage = loadTileImage("door_open")
const doorOpenTopImage = loadTileImage("door_open_top")
const ladderTopImage = loadTileImage("ladder_top")
const ladderMiddleImage = loadTileImage("ladder_middle")
const ladderBottomImage = loadTileImage("ladder_bottom")

/** @type {Record<string, HTMLImageElement>} */
const dynamicTileImages = {}

/**
 * @param {string} name
 */
function getDynamicTile(name) {
  if (!dynamicTileImages[name]) dynamicTileImages[name] = loadTileImage(name)
  return dynamicTileImages[name]
}

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
  drawFluidTiles(model, view, width, height, worldWidth, worldHeight)
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
  /** Let the editor show padding past the map edges (cursor on top row was clipped). */
  const pad = model.editorMode ? TILE_SIZE * 4 : 0
  const minCamX = -pad
  const minCamY = -pad
  const maxCamX = Math.max(minCamX, model.world.width - viewportWorldWidth)
  const maxCamY = Math.max(minCamY, model.world.height - viewportWorldHeight)
  const desiredCameraX = clamp(
    desiredFocus.x - viewportWorldWidth / 2,
    minCamX,
    maxCamX,
  )
  const desiredCameraY = clamp(
    desiredFocus.y - viewportWorldHeight / 2,
    minCamY,
    maxCamY,
  )

  model.camera.x = clamp(lerp(model.camera.x, desiredCameraX, 0.12), minCamX, maxCamX)
  model.camera.y = clamp(lerp(model.camera.y, desiredCameraY, 0.12), minCamY, maxCamY)
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
 * @param {number} _offsetX
 * @param {number} offsetY
 */
function drawParallax(model, view, _offsetX, offsetY) {
  const ctx = view.ctx.back
  ctx.fillStyle = "#c3e3ff"
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)

  // const centeredOffsetX = Math.max(0, (width - worldWidth) / 2)
  // const centeredOffsetY = Math.max(0, (height - worldHeight) / 2)
  const size = Math.floor(BG_IMG_WIDTH * view.scale)
  const cloudHeight = size
  const fadeHeight = size
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

  const cache = getTerrainCache(level, model)
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
 * @param {number} width
 * @param {number} height
 * @param {number} worldWidth
 * @param {number} worldHeight
 */
function drawFluidTiles(
  model,
  view,
  width,
  height,
  worldWidth,
  worldHeight,
) {
  const ctx = view.ctx.tiles
  const level = model.levels[0]
  if (!level) return
  const terrainRows = level.layers.terrain ?? []
  const variantRows = level.layers.terrainVariant ?? []
  const centeredOffsetX = Math.max(0, (width - worldWidth) / 2)
  const centeredOffsetY = Math.max(0, (height - worldHeight) / 2)
  const drawX = Math.round(centeredOffsetX - model.camera.x * view.scale)
  const drawY = Math.round(centeredOffsetY - model.camera.y * view.scale)
  const ts = TILE_SIZE * view.scale
  const flip = Math.floor(model.elapsed * 2.8) % 2 === 0

  for (let ty = 0; ty < terrainRows.length; ty++) {
    const row = terrainRows[ty] ?? ""
    for (let tx = 0; tx < row.length; tx++) {
      if (row[tx] !== "0") continue
      const ch = variantRows[ty]?.[tx] ?? " "
      if (!isFluidChar(ch)) continue
      const px = drawX + tx * ts
      const py = drawY + ty * ts
      const img = ch === FLUID_LAVA ? lavaFluidImage : waterFluidImage
      if (img?.complete) {
        ctx.save()
        ctx.translate(Math.round(px + ts / 2), Math.round(py + ts / 2))
        ctx.scale(flip ? -1 : 1, 1)
        ctx.drawImage(
          img,
          Math.round(-ts / 2),
          Math.round(-ts / 2),
          Math.ceil(ts),
          Math.ceil(ts),
        )
        ctx.restore()
      } else {
        ctx.fillStyle = ch === FLUID_LAVA ? "#dc2626" : "#0ea5e9"
        ctx.fillRect(Math.round(px), Math.round(py), Math.ceil(ts), Math.ceil(ts))
      }
    }
  }
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

    if (object.kind === "fish") {
      const fx = object.fishX ?? object.x * TILE_SIZE
      const fy = object.fishY ?? object.y * TILE_SIZE
      const img = getDynamicTile("coin_gold")
      const s = 16 * view.scale
      if (img?.complete) {
        ctx.drawImage(
          img,
          Math.round(offsetX + fx - s * 0.2),
          Math.round(offsetY + fy - s * 0.35),
          Math.round(s),
          Math.round(s),
        )
      }
      continue
    }

    if (object.kind === "hill") {
      const img = getHillFaceImage(model)
      const objectX = offsetX + object.x * TILE_SIZE * view.scale
      const objectY = offsetY + object.y * TILE_SIZE * view.scale
      const drawX = objectX + (object.width * tileSize - tileSize) / 2
      const drawY = objectY + (object.height * tileSize - tileSize) / 2
      if (img?.complete) {
        ctx.drawImage(
          img,
          Math.round(drawX),
          Math.round(drawY),
          tileSpan,
          tileSpan,
        )
      }
      continue
    }

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

    if (
      object.kind === "color_block" ||
      object.kind === "spring" ||
      object.kind === "cactus" ||
      object.kind === "flag" ||
      object.kind === "conveyor" ||
      object.kind === "bomb" ||
      object.kind === "spikes" ||
      object.kind === "saw" ||
      object.kind === "switch" ||
      object.kind === "fireball" ||
      object.kind === "bomb_entity" ||
      object.kind === "decoration" ||
      object.kind === "block_coin" ||
      object.kind === "block_exclamation" ||
      object.kind === "block_strong_exclamation" ||
      object.kind === "block_strong_danger" ||
      object.kind === "block_planks" ||
      object.kind === "bridge" ||
      object.kind === "bridge_logs" ||
      object.kind === "torch" ||
      object.kind === "weight" ||
      object.kind === "rope" ||
      object.kind === "chain" ||
      object.kind === "rock" ||
      (typeof object.kind === "string" &&
        object.kind.startsWith("block_") &&
        !INTERACTIVE_BLOCK_KINDS.has(object.kind))
    ) {
      const sp = object.sprite ?? "gem_blue"
      const image = getDynamicTile(sp)
      const objectX = offsetX + object.x * TILE_SIZE * view.scale
      const objectY = offsetY + object.y * TILE_SIZE * view.scale
      const drawX = objectX + (object.width * tileSize - tileSize) / 2
      const drawY = objectY + (object.height * tileSize - tileSize) / 2
      if (object.kind === "conveyor") {
        const flip = Number(object.state ?? 1) < 0
        if (image.complete) {
          const cx = drawX + tileSize / 2
          const cy = drawY + tileSize / 2
          ctx.save()
          ctx.translate(cx, cy)
          if (flip) ctx.scale(-1, 1)
          ctx.drawImage(
            image,
            Math.round(-tileSize / 2),
            Math.round(-tileSize / 2),
            tileSpan,
            tileSpan,
          )
          ctx.restore()
          drawConveyorBeltArrowOverlay(
            ctx,
            image,
            Math.round(drawX),
            Math.round(drawY),
            tileSpan,
            tileSpan,
            model.elapsed,
            flip,
          )
        }
        continue
      }
      if (object.kind === "saw") {
        const cx = drawX + tileSize / 2
        const cy = drawY + tileSize / 2
        ctx.save()
        ctx.translate(cx, cy)
        ctx.rotate(model.elapsed * 3)
        if (image.complete) {
          ctx.drawImage(
            image,
            -tileSize / 2,
            -tileSize / 2,
            tileSpan,
            tileSpan,
          )
        }
        ctx.restore()
        continue
      }
      if (image.complete) {
        if (object.kind === "spikes" && object.upsideDown) {
          const cx = drawX + tileSize / 2
          const cy = drawY + tileSize / 2
          ctx.save()
          ctx.translate(cx, cy)
          ctx.scale(1, -1)
          ctx.drawImage(image, -tileSize / 2, -tileSize / 2, tileSpan, tileSpan)
          ctx.restore()
        } else {
          ctx.drawImage(
            image,
            Math.round(drawX),
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
          : object.kind === "coin"
            ? getDynamicTile(object.sprite ?? "coin_gold")
            : (gemImages[object.sprite ?? "gem_blue"] ?? fallbackGemImage)
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
          : object.kind === "coin"
            ? "#eab308"
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
    220 * s,
    width / Math.max(1, model.players.length),
  )
  const panelHeight = 76 * s
  const margin = 12 * s

  ctx.save()
  ctx.fillStyle = "rgba(2, 6, 23, 0.78)"
  ctx.fillRect(width / 2 - 70 * s, 12 * s, 140 * s, 26 * s)
  ctx.strokeStyle = "#38bdf8"
  ctx.lineWidth = Math.max(1, 2 * s)
  ctx.strokeRect(width / 2 - 70 * s, 12 * s, 140 * s, 26 * s)
  ctx.fillStyle = "#e2e8f0"
  ctx.font = `${Math.max(11, Math.round(13 * s))}px monospace`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(`Level ${Math.max(1, model.levels.length)}`, width / 2, 25 * s)
  ctx.restore()

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
    drawHudGems(ctx, player, panelX + 100 * s, panelY + 22 * s, s)
    drawHudCoins(ctx, player, panelX + 150 * s, panelY + 22 * s, s)
    drawHudKeys(ctx, player, panelX + 10 * s, panelY + 48 * s, s)
    ctx.restore()
  }
}

/**
 * @param {import('./game-state.js').GameModel} model
 * @param {import('./game-state.js').GameView} view
 * @param {number} width
 * @param {number} height
 */
/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text
 * @param {number} centerX
 * @param {number} startY
 * @param {number} maxWidth
 * @param {number} lineHeight
 */
/**
 * @param {import('./game-state.js').GameModel} model
 * @param {string} placeableId
 * @param {number} pi
 */
function editorColorNameForPlaceable(model, placeableId, pi) {
  const slot = pi === 1 ? 1 : 0
  const map = model.editorColorsById[slot] ?? {}
  const v = map[placeableId]
  const colorIx = model.editorColorIndex[slot] ?? 0
  const idx = v !== undefined ? v : colorIx
  return EDITOR_COLORS[idx] ?? "blue"
}

/**
 * Preview of the currently selected editor tool inside the HUD panel.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('./game-state.js').GameModel} model
 * @param {{ id: string } | undefined} thing
 * @param {number} left
 * @param {number} top
 * @param {number} size
 * @param {number} s
 * @param {number} pi
 */
function drawEditorSelectionPreview(ctx, model, thing, left, top, size, s, pi) {
  if (!thing) return

  ctx.save()
  const pad = Math.max(2, 3 * s)
  ctx.fillStyle = "rgba(15, 23, 42, 0.72)"
  ctx.fillRect(left, top, size, size)
  ctx.strokeStyle = "#475569"
  ctx.lineWidth = Math.max(1, s)
  ctx.strokeRect(Math.round(left), Math.round(top), Math.ceil(size), Math.ceil(size))

  const inner = size - 2 * pad
  const cx = left + size / 2
  const colorName = editorColorNameForPlaceable(model, thing.id, pi)

  /**
   * @param {HTMLImageElement | undefined} img
   * @param {number} dx
   * @param {number} dy
   * @param {number} w
   * @param {number} h
   */
  const blit = (img, dx, dy, w, h) => {
    if (img?.complete) {
      ctx.drawImage(img, Math.round(dx), Math.round(dy), Math.round(w), Math.round(h))
    }
  }

  switch (thing.id) {
    case "terrain": {
      const bi = pi === 1 ? 1 : 0
      const biome =
        /** @type {import('./terrain-biome.js').TerrainBiome} */ (
          TERRAIN_BIOMES[model.editorBiomeIndex[bi]] ??
            TERRAIN_BIOMES[0] ??
            "grass"
        )
      const biCh = biomeToChar(biome)
      const terrainRows = ["000", "010", "000"]
      const variantRows = ["   ", ` ${biCh} `, "   "]
      const img = getTerrainTileForCell(terrainRows, variantRows, 1, 1)
      const w = inner * 0.92
      blit(img, cx - w / 2, top + pad + (inner - w) / 2, w, w)
      break
    }
    case "fluid": {
      const bi = pi === 1 ? 1 : 0
      const isLava = model.editorFluidIsLava[bi] === true
      const img = isLava ? lavaFluidImage : waterFluidImage
      const w = inner * 0.92
      blit(img, cx - w / 2, top + pad + (inner - w) / 2, w, w)
      break
    }
    case "ladder": {
      const rows = 3
      const h = inner / rows
      const x0 = cx - h / 2
      for (let i = 0; i < rows; i++) {
        const img =
          i === 0
            ? ladderTopImage
            : i === rows - 1
              ? ladderBottomImage
              : ladderMiddleImage
        blit(img, x0, top + pad + i * h, h, h)
      }
      break
    }
    case "gem": {
      const img = gemImages[`gem_${colorName}`] ?? gemImages["gem_blue"]
      const w = inner * 0.85
      blit(img, cx - w / 2, top + pad + (inner - w) / 2, w, w)
      break
    }
    case "coin": {
      const bi = pi === 1 ? 1 : 0
      const cv =
        EDITOR_COIN_VARIANTS[model.editorCoinVariantIndex[bi] ?? 0] ??
        EDITOR_COIN_VARIANTS[0]
      const img = getDynamicTile(cv?.sprite ?? "coin_gold")
      const w = inner * 0.85
      blit(img, cx - w / 2, top + pad + (inner - w) / 2, w, w)
      break
    }
    case "key": {
      const img = keyImages[`key_${colorName}`] ?? keyImages["key_blue"]
      const w = inner * 0.85
      blit(img, cx - w / 2, top + pad + (inner - w) / 2, w, w)
      break
    }
    case "color_block": {
      const img = getDynamicTile(`block_${colorName}`)
      const w = inner * 0.85
      blit(img, cx - w / 2, top + pad + (inner - w) / 2, w, w)
      break
    }
    case "lock": {
      const imgBase = lockImages[`lock_${colorName}`] ?? lockImages["lock_blue"]
      const w = inner * 0.85
      blit(imgBase, cx - w / 2, top + pad + (inner - w) / 2, w, w)
      break
    }
    case "exit_door": {
      const rows = 2
      const h = inner / rows
      const x0 = cx - h / 2
      blit(doorClosedTopImage, x0, top + pad, h, h)
      blit(doorClosedImage, x0, top + pad + h, h, h)
      break
    }
    case "spring": {
      const img = getDynamicTile("spring")
      const w = inner * 0.85
      blit(img, cx - w / 2, top + pad + (inner - w) / 2, w, w)
      break
    }
    case "flag": {
      const phase = Math.floor(model.elapsed * 8) % 2 === 0 ? "a" : "b"
      const img = getDynamicTile(`flag_${colorName}_${phase}`)
      const w = inner * 0.85
      blit(img, cx - w / 2, top + pad + (inner - w) / 2, w, w)
      break
    }
    case "conveyor": {
      const bi = pi === 1 ? 1 : 0
      const beltLeft = model.editorConveyorDirIndex[bi] === 1
      const img = getDynamicTile("conveyor")
      const w = inner * 0.85
      const tileTop = top + pad + (inner - w) / 2
      const tileLeft = cx - w / 2
      ctx.save()
      ctx.translate(cx, top + pad + inner / 2)
      if (beltLeft) ctx.scale(-1, 1)
      blit(img, -w / 2, -w / 2, w, w)
      ctx.restore()
      if (img.complete) {
        drawConveyorBeltArrowOverlay(
          ctx,
          img,
          tileLeft,
          tileTop,
          w,
          w,
          model.elapsed,
          beltLeft,
        )
      }
      break
    }
    case "hazard": {
      const bi = pi === 1 ? 1 : 0
      const v =
        EDITOR_HAZARD_VARIANTS[model.editorHazardVariantIndex[bi] ?? 0] ??
        EDITOR_HAZARD_VARIANTS[0]
      const img = getDynamicTile(v?.sprite ?? "spikes")
      const w = inner * (v?.kind === "saw" ? 0.72 : 0.85)
      if (v?.kind === "saw") {
        ctx.save()
        ctx.translate(cx, top + pad + inner / 2)
        ctx.rotate(model.elapsed * 3)
        blit(img, -w / 2, -w / 2, w, w)
        ctx.restore()
      } else {
        blit(img, cx - w / 2, top + pad + (inner - w) / 2, w, w)
      }
      break
    }
    case "brick": {
      const bi = pi === 1 ? 1 : 0
      const v =
        EDITOR_BRICK_VARIANTS[model.editorBrickVariantIndex[bi] ?? 0] ??
        EDITOR_BRICK_VARIANTS[0]
      if (v?.kind === "hill") {
        const img = getHillFaceImage(model)
        const w = inner * 0.92
        blit(img, cx - w / 2, top + pad + (inner - w) / 2, w, w)
      } else {
        const img = getDynamicTile(v?.sprite ?? "bricks_brown")
        const w = inner * 0.85
        blit(img, cx - w / 2, top + pad + (inner - w) / 2, w, w)
      }
      break
    }
    case "bomb": {
      const img = getDynamicTile("bomb")
      const w = inner * 0.85
      blit(img, cx - w / 2, top + pad + (inner - w) / 2, w, w)
      break
    }
    case "switch": {
      const img = getDynamicTile(`switch_${colorName}`)
      const w = inner * 0.85
      blit(img, cx - w / 2, top + pad + (inner - w) / 2, w, w)
      break
    }
    case "special_block": {
      const bi = pi === 1 ? 1 : 0
      const v =
        EDITOR_BLOCK_VARIANTS[model.editorBlockVariantIndex[bi]] ??
        EDITOR_BLOCK_VARIANTS[0]
      const sp = v?.sprite ?? "block_coin"
      const img = getDynamicTile(sp)
      const w = inner * 0.85
      blit(img, cx - w / 2, top + pad + (inner - w) / 2, w, w)
      break
    }
    case "bridge": {
      const bi = pi === 1 ? 1 : 0
      const v =
        EDITOR_BRIDGE_VARIANTS[model.editorBridgeVariantIndex[bi] ?? 0] ??
        EDITOR_BRIDGE_VARIANTS[0]
      const w = inner * 0.85
      blit(
        getDynamicTile(v?.sprite ?? "bridge"),
        cx - w / 2,
        top + pad + (inner - w) / 2,
        w,
        w,
      )
      break
    }
    case "torch": {
      const w = inner * 0.85
      const fr =
        Math.floor(model.elapsed * 8) % 2 === 0 ? "torch_on_a" : "torch_on_b"
      blit(getDynamicTile(fr), cx - w / 2, top + pad + (inner - w) / 2, w, w)
      break
    }
    case "rope": {
      const bi = pi === 1 ? 1 : 0
      const v =
        EDITOR_ROPE_VARIANTS[model.editorRopeVariantIndex[bi] ?? 0] ??
        EDITOR_ROPE_VARIANTS[0]
      const w = inner * 0.85
      blit(
        getDynamicTile(v?.sprite ?? "rope"),
        cx - w / 2,
        top + pad + (inner - w) / 2,
        w,
        w,
      )
      break
    }
    case "rock": {
      const bi = pi === 1 ? 1 : 0
      const v =
        EDITOR_ROCK_VARIANTS[model.editorRockVariantIndex[bi] ?? 0] ??
        EDITOR_ROCK_VARIANTS[0]
      const w = inner * 0.85
      blit(
        getDynamicTile(v?.sprite ?? "rock"),
        cx - w / 2,
        top + pad + (inner - w) / 2,
        w,
        w,
      )
      break
    }
    default: {
      ctx.fillStyle = "#64748b"
      ctx.font = `${Math.max(8, Math.round(10 * s))}px monospace`
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText("?", cx, top + size / 2)
    }
  }

  ctx.restore()
}

/**
 * @param {GameLevelObject} object
 * @param {number} tx
 * @param {number} ty
 * @returns {boolean}
 */
function objectCoversTileEditor(object, tx, ty) {
  const left = object.x
  const right = object.x + object.width - 1
  const top = object.y - object.height + 1
  const bottom = object.y
  return tx >= left && tx <= right && ty >= top && ty <= bottom
}

/**
 * @param {GameLevelObject} o
 * @returns {string}
 */
function objectInspectLabel(o) {
  const kind = o.kind ?? "?"
  if (kind === "conveyor" && o.state !== undefined) {
    const left = Number(o.state) < 0
    return `conveyor(${left ? "left" : "right"})`
  }
  const sprite = o.sprite ? String(o.sprite) : ""
  if (sprite && sprite !== kind) return `${kind}(${sprite})`
  return kind
}

/**
 * @param {GameLevel | undefined} level
 * @param {number} tx
 * @param {number} ty
 * @returns {string}
 */
function formatEditorCellSummary(level, tx, ty) {
  if (!level?.layers.terrain) return "no terrain layer"
  const rows = level.layers.terrain
  if (ty < 0 || ty >= rows.length) return "out of bounds"
  const row = rows[ty]
  if (!row || tx < 0 || tx >= row.length) return "out of bounds"
  const cell = row[tx]
  const vr = level.layers.terrainVariant?.[ty]?.[tx] ?? " "

  /** Terrain (grid) vs objects are always separated — avoids reading “air objects” as one phrase. */
  let terrainLine
  if (cell === "1") {
    terrainLine = `terrain: solid (${charToBiome(vr)})`
  } else if (cell === "0") {
    const fluid = getFluidAtTile(level, tx, ty)
    terrainLine = fluid ? `terrain: air + ${fluid}` : "terrain: air"
  } else {
    terrainLine = `terrain: "${cell}"`
  }

  const hits = []
  for (const o of level.objects) {
    if (o.collected) continue
    if (!objectCoversTileEditor(o, tx, ty)) continue
    hits.push(objectInspectLabel(o))
  }
  hits.sort((a, b) => a.localeCompare(b))
  const objectLine =
    hits.length > 0 ? `objects: ${hits.join(", ")}` : "objects: (none)"
  return `${terrainLine} · ${objectLine}`
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text
 * @param {number} centerX
 * @param {number} startY
 * @param {number} maxWidth
 * @param {number} lineHeight
 * @param {number} fontPx
 */
function wrapEditorTextSimple(
  ctx,
  text,
  centerX,
  startY,
  maxWidth,
  lineHeight,
  fontPx,
) {
  const words = text.split(/\s+/).filter(Boolean)
  /** @type {string[]} */
  const lines = []
  let line = ""
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (line && ctx.measureText(test).width > maxWidth) {
      lines.push(line)
      line = w
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  let y = startY
  ctx.fillStyle = "#94a3b8"
  ctx.font = `${fontPx}px monospace`
  for (const l of lines) {
    ctx.fillText(l, centerX, y)
    y += lineHeight
  }
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text
 * @param {number} centerX
 * @param {number} startY
 * @param {number} maxWidth
 * @param {number} lineHeight
 */
function wrapEditorText(ctx, text, centerX, startY, maxWidth, lineHeight) {
  const parts = text.split(" · ")
  /** @type {string[]} */
  const lines = []
  let line = ""
  for (let i = 0; i < parts.length; i++) {
    const piece = parts[i] ?? ""
    const segment = i === 0 ? piece : ` · ${piece}`
    const test = line + segment
    if (line && ctx.measureText(test).width > maxWidth) {
      lines.push(line)
      line = piece
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  let y = startY
  for (const l of lines) {
    ctx.fillText(l, centerX, y)
    y += lineHeight
  }
}

/**
 * @param {import('./game-state.js').GameModel} model
 * @param {import('./game-state.js').GameView} view
 * @param {number} width
 * @param {number} _height
 * @param {number} offsetX
 * @param {number} offsetY
 */
function drawEditorOverlay(model, view, width, _height, offsetX, offsetY) {
  const ctx = view.ctx.objects
  const s = view.scale
  const ts = TILE_SIZE * s
  const n = Math.min(model.players.length, 2)
  const gap = 8 * s
  const margin = 8 * s

  ctx.save()

  for (let pi = 0; pi < n; pi++) {
    const player = model.players[pi]
    if (!player) continue
    const slot = pi === 1 ? 1 : 0
    const px = offsetX + (model.editorTileX[slot] ?? 0) * ts
    const py = offsetY + (model.editorTileY[slot] ?? 0) * ts
    ctx.strokeStyle = getPlayerLabelColor(player)
    ctx.lineWidth = Math.max(2, 2 * s)
    ctx.setLineDash([6 * s, 4 * s])
    ctx.strokeRect(Math.round(px), Math.round(py), Math.ceil(ts), Math.ceil(ts))
  }
  ctx.setLineDash([])

  const barH = 132 * s
  const previewCol = 100 * s
  const barW =
    n <= 1
      ? Math.min(620 * s, width - 16 * s)
      : Math.min(360 * s, (width - 2 * margin - gap) / 2)

  for (let pi = 0; pi < n; pi++) {
    const player = model.players[pi]
    if (!player) continue
    const slot = pi === 1 ? 1 : 0
    const bx =
      n <= 1 ? (width - barW) / 2 : pi === 0 ? margin : width - margin - barW
    const by = margin
    const textAreaCenter = bx + previewCol + (barW - previewCol) / 2
    const rosterMaxW = barW - previewCol - 20 * s

    const thing = EDITOR_PLACEABLES[model.editorThingIndex[slot] ?? 0]
    const label = thing?.label ?? "?"
    const toolSlot = (model.editorThingIndex[slot] ?? 0) + 1
    const total = EDITOR_PLACEABLES.length

    ctx.fillStyle = "rgba(2, 6, 23, 0.92)"
    ctx.fillRect(bx, by, barW, barH)
    ctx.strokeStyle = getPlayerLabelColor(player)
    ctx.lineWidth = Math.max(1, 2 * s)
    ctx.strokeRect(bx, by, barW, barH)

    const previewSize = Math.min(previewCol - 14 * s, barH - 18 * s)
    drawEditorSelectionPreview(
      ctx,
      model,
      thing,
      bx + 7 * s,
      by + 7 * s,
      previewSize,
      s,
      slot,
    )

    const curThing = model.editorThingIndex[slot] ?? 0
    const toolRoster = EDITOR_PLACEABLES.map((p, i) =>
      i === curThing ? `[${p.label}]` : p.label,
    ).join(" · ")

    ctx.fillStyle = "#94a3b8"
    ctx.font = `${Math.max(7, Math.round(9 * s))}px monospace`
    ctx.textAlign = "center"
    ctx.textBaseline = "top"
    wrapEditorText(
      ctx,
      toolRoster,
      textAreaCenter,
      by + 6 * s,
      rosterMaxW,
      Math.max(7, Math.round(9 * s)) * 1.25,
    )

    const fontSmall = Math.max(7, Math.round(9 * s))
    const lineSmall = fontSmall * 1.2
    const tx = model.editorTileX[slot] ?? 0
    const ty = model.editorTileY[slot] ?? 0
    const cellInfo = formatEditorCellSummary(model.levels[0], tx, ty)
    ctx.textAlign = "center"
    ctx.textBaseline = "top"
    wrapEditorTextSimple(
      ctx,
      cellInfo,
      textAreaCenter,
      by + 46 * s,
      rosterMaxW,
      lineSmall,
      fontSmall,
    )

    ctx.fillStyle = "#e2e8f0"
    ctx.font = `${Math.max(10, Math.round(12 * s))}px monospace`
    ctx.textBaseline = "middle"
    const thingRow = EDITOR_PLACEABLES[curThing]
    let extra = "—"
    if (thingRow?.biomes) {
      extra =
        TERRAIN_BIOMES[model.editorBiomeIndex[slot]] ??
        TERRAIN_BIOMES[0] ??
        "?"
    } else if (thingRow?.colors) {
      extra = editorColorNameForPlaceable(model, thingRow.id, slot)
    } else if (thingRow?.id === "conveyor") {
      extra = model.editorConveyorDirIndex[slot] === 1 ? "←" : "→"
    } else if (thingRow?.variants) {
      if (thingRow.id === "special_block") {
        const v = EDITOR_BLOCK_VARIANTS[model.editorBlockVariantIndex[slot]]
        extra = v?.kind ?? "?"
      } else if (thingRow.id === "hazard") {
        extra =
          EDITOR_HAZARD_VARIANTS[model.editorHazardVariantIndex[slot] ?? 0]
            ?.label ?? "?"
      } else if (thingRow.id === "brick") {
        extra =
          EDITOR_BRICK_VARIANTS[model.editorBrickVariantIndex[slot] ?? 0]
            ?.label ?? "?"
      } else if (thingRow.id === "coin") {
        extra =
          EDITOR_COIN_VARIANTS[model.editorCoinVariantIndex[slot] ?? 0]?.label ??
          "?"
      } else if (thingRow.id === "bridge") {
        extra =
          EDITOR_BRIDGE_VARIANTS[model.editorBridgeVariantIndex[slot] ?? 0]
            ?.label ?? "?"
      } else if (thingRow.id === "rope") {
        extra =
          EDITOR_ROPE_VARIANTS[model.editorRopeVariantIndex[slot] ?? 0]
            ?.label ?? "?"
      } else if (thingRow.id === "rock") {
        extra =
          EDITOR_ROCK_VARIANTS[model.editorRockVariantIndex[slot] ?? 0]?.label ??
          "?"
      } else {
        extra = "?"
      }
    } else if (thingRow?.id === "fluid") {
      extra = model.editorFluidIsLava[slot] ? "lava" : "water"
    }
    ctx.fillText(
      `P${pi + 1}  ${label}  ${extra}  [${toolSlot}/${total}]  (${model.editorTileX[slot]},${model.editorTileY[slot]})`,
      textAreaCenter,
      by + barH - 28 * s,
    )
  }

  const hintY = margin + barH + 6 * s
  ctx.font = `${Math.max(8, Math.round(10 * s))}px monospace`
  ctx.fillStyle = "#94a3b8"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(
    "B editor · Q/X (Y on pad) cycle variants · F place · V/Delete remove · P1 arrows · P2 WASD",
    width / 2,
    hintY,
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
  const maxH = player.maxHeartHalves ?? player.maxHearts * 2
  const halves = player.heartHalves ?? player.hearts * 2

  for (let i = 0; i < maxH; i += 2) {
    const drawX = x + (i / 2) * (size + gap)
    let image = hudHeartEmptyImage
    if (halves >= i + 2) {
      image = hudHeartImage
    } else if (halves >= i + 1) {
      image = hudHeartHalfImage
    }
    if (image.complete) {
      ctx.drawImage(image, drawX, y, size, size)
    } else {
      ctx.fillStyle =
        halves >= i + 2 ? "#ef4444" : halves >= i + 1 ? "#f97316" : "#475569"
      ctx.fillRect(drawX, y, size, size)
    }
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
function drawHudCoins(ctx, player, x, y, scale) {
  const size = 16 * scale

  if (hudCoinImage?.complete) {
    ctx.drawImage(hudCoinImage, x, y, size, size)
  } else {
    ctx.fillStyle = "#eab308"
    ctx.fillRect(x, y, size, size)
  }

  ctx.fillStyle = "#f8fafc"
  ctx.font = `${Math.max(10, Math.round(12 * scale))}px monospace`
  ctx.textBaseline = "middle"
  ctx.fillText(`${player.coins}`, x + size + 8 * scale, y + size / 2)
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
 * @param {number} x
 * @param {number} y
 * @returns {boolean}
 */
function isTerrainSolid(terrainRows, x, y) {
  const row = terrainRows[y]
  if (y < 0 || y >= terrainRows.length || !row || x < 0 || x >= row.length) {
    return false
  }
  return row[x] === "1"
}

/**
 * Top-row variants (exposed upward, solid below).
 *
 * @param {string[]} terrainRows
 * @param {string[]} variantRows
 * @param {number} tileX
 * @param {number} tileY
 * @returns {HTMLImageElement}
 */
function getTerrainTopImage(terrainRows, variantRows, tileX, tileY) {
  const ch = variantRows[tileY]?.[tileX] ?? " "
  const biome = charToBiome(ch)
  const g = BIOME_TILES[biome] ?? BIOME_TILES["grass"]
  if (!g) return terrainBlockImage
  const row = terrainRows[tileY] ?? ""
  const belowRow = terrainRows[tileY + 1] ?? ""
  const leftFilled = row[tileX - 1] === "1"
  const rightFilled = row[tileX + 1] === "1"
  const belowFilled = belowRow[tileX] === "1"

  if (!leftFilled && !rightFilled) {
    return belowFilled ? g.vTop : g.block
  }
  if (!leftFilled) return g.topLeft
  if (!rightFilled) return g.topRight
  return g.top
}

/**
 * Picks tile from neighbor mask (floating islands, cliffs, strips).
 *
 * @param {string[]} terrainRows
 * @param {string[]} variantRows
 * @param {number} tileX
 * @param {number} tileY
 * @returns {HTMLImageElement}
 */
function getTerrainTileForCell(terrainRows, variantRows, tileX, tileY) {
  const ch = variantRows[tileY]?.[tileX] ?? " "
  const biome = charToBiome(ch)
  const g = BIOME_TILES[biome] ?? BIOME_TILES["grass"]
  if (!g) return terrainBlockImage

  const U = isTerrainSolid(terrainRows, tileX, tileY - 1)
  const D = isTerrainSolid(terrainRows, tileX, tileY + 1)
  const L = isTerrainSolid(terrainRows, tileX - 1, tileY)
  const R = isTerrainSolid(terrainRows, tileX + 1, tileY)
  const aU = !U
  const aD = !D
  const aL = !L
  const aR = !R

  if (U && D && L && R) {
    return g.center
  }

  if (aU && aL && D && R) {
    return g.topLeft
  }
  if (aU && aR && D && L) {
    return g.topRight
  }
  if (aD && aL && U && R) {
    return g.bottomLeft
  }
  if (aD && aR && U && L) {
    return g.bottomRight
  }

  if (aU && D) {
    return getTerrainTopImage(terrainRows, variantRows, tileX, tileY)
  }

  if (aD && U && L && R) {
    return g.bottom
  }

  if (aL && U && D && R) {
    return g.left
  }
  if (aR && U && D && L) {
    return g.right
  }

  if (aU && aD && L && R) {
    return g.hMid
  }
  if (aU && aD && aL && R) {
    return g.hLeft
  }
  if (aU && aD && aR && L) {
    return g.hRight
  }

  if (aL && aR && U && D) {
    return g.vMid
  }
  if (aL && aR && U && aD) {
    return g.vBottom
  }

  return g.block
}

/**
 * @param {GameLevel} level
 * @param {import('./game-state.js').GameModel} model
 * @returns {HTMLCanvasElement | null}
 */
function getTerrainCache(level, model) {
  const variantRows = level.layers.terrainVariant ?? []
  const variantSig = variantRows.join("\n")
  const cacheKey = `${level.width}x${level.height}:${level.generatedFrom.seed}:${level.generatedFrom.version}:t${model.terrainRevision}:v${variantSig}`
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
      const tileImage = getTerrainTileForCell(
        terrainRows,
        variantRows,
        tileX,
        tileY,
      )

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
