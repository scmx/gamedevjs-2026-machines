import { updateEditors } from "./editor-init.js"
import { applyEditInstructions } from "./editor-edit-log.js"
import { generateLevel } from "./editor-terrain.js"
import {
  applyConveyorBelts,
  applyDamage,
  applySpikesAndSaws,
  applySprings,
  getObjectBounds,
  INTERACTIVE_BLOCK_KINDS,
  resolveSolidNonLockObjects,
  tickHurtCooldowns,
  tickSpringSprites,
  trySwitches,
  updateFallingObjects,
  updateFireballs,
  updateInteractiveBlocks,
  updateSawAngles,
  spawnFireball,
} from "./game-entities.js"
import { savePlayerSkinsFromModel } from "./game-prefs.js"
import { getFluidAtTile } from "./terrain-fluid.js"
import {
  playSoundBlockCoinOrLockOpen,
  playSoundCoinPickup,
  playSoundGemPickup,
  playSoundJump,
  playSoundKeyPickup,
  playSoundLevelComplete,
  syncMusicModeToLevel,
} from "./game-sounds.js"
import {
  TILE_SIZE,
  cyclePlayerSkin,
  resetPlayersForNewLevel,
  respawnPlayersIfDead,
} from "./game-state.js"

/**
 * Animate torch flames (Kenney torch_on_a / torch_on_b).
 *
 * @param {import('./game-state.js').GameModel} model
 */
function tickTorchSpritesInLevel(model) {
  const level = model.levels[0]
  if (!level) return
  const phase = Math.floor(model.elapsed * 8) % 2
  for (const object of level.objects) {
    if (object.kind !== "torch" || object.collected) continue
    object.sprite = phase === 0 ? "torch_on_a" : "torch_on_b"
  }
}

/**
 * @param {import('./game-state.js').GameModel} model
 * @param {GameInput[]} inputs
 * @param {number} deltaTime
 */
export function update(model, inputs, deltaTime) {
  model.elapsed += deltaTime

  const p0 = inputs[0] ?? EMPTY_INPUT
  const p1 = inputs[1] ?? EMPTY_INPUT
  updateMainMenuToggle(model, p0, p1)

  if (model.menuOpen) {
    for (const player of model.players) {
      player.velocity.x = 0
      player.velocity.y = 0
    }
    return
  }

  updateEditors(model, [p0, p1])

  if (model.editorMode) {
    for (const player of model.players) {
      player.velocity.x = 0
      player.velocity.y = 0
    }
    return
  }

  tickHurtCooldowns(model, deltaTime)
  tickSpringSprites(model, deltaTime)
  tickTorchSpritesInLevel(model)
  tickFlagSpritesInLevel(model)
  tickCoinSpritesInLevel(model)
  updateSawAngles(model)

  trySpawnFish(model, deltaTime)
  updateFishDecorations(model, deltaTime)

  for (const player of model.players) {
    const input = inputs[player.index] ?? EMPTY_INPUT
    updatePlayer(player, model, input, deltaTime)
  }

  resolveSolidNonLockObjects(model)
  applySprings(model, model.jumpSpeed)
  applyConveyorBelts(model, deltaTime, resolveTerrainCollisions)
  resolveSolidNonLockObjects(model)
  updateFallingObjects(model, deltaTime)
  applySpikesAndSaws(model)
  trySwitches(model)
  tryPunchNearbyBlocks(model, inputs)
  tryShootFireballs(model, inputs, deltaTime)
  updateFireballs(model, deltaTime)
  updateInteractiveBlocks(model, deltaTime)

  resolveLocks(model)
  collectPickups(model)

  tryExitDoorLevelTransition(model)
  respawnPlayersIfDead(model)
  constrainPlayerSpacing(model)
}

/**
 * @param {import('./game-state.js').GameModel} model
 * @param {GameInput} p0
 * @param {GameInput} p1
 */
function updateMainMenuToggle(model, p0, p1) {
  const anyToggle = Boolean(p0.menuToggle || p1.menuToggle)
  const toggleEdge = Boolean(anyToggle && !model._menuPrevToggleAny)
  model._menuPrevToggleAny = anyToggle

  if (!toggleEdge) return

  model.menuOpen = !model.menuOpen
  if (model.menuOpen) {
    model.editorMode = false
    model._editorPrevToggleAny = false
  }
}

/**
 * @param {import('./game-state.js').GameModel} model
 * @param {GameInput[]} inputs
 * @param {number} _dt
 */
function tryShootFireballs(model, inputs, _dt) {
  for (const player of model.players) {
    const input = inputs[player.index] ?? EMPTY_INPUT
    if (input.shoot && !player.shootPressed) {
      const dir = player.velocity.x < -1 ? -1 : 1
      const wx = player.pos.x + (dir < 0 ? 0 : player.size.x)
      const wy = player.pos.y + player.size.y * 0.35
      spawnFireball(model, wx, wy, dir)
    }
    player.shootPressed = Boolean(input.shoot)
  }
}

const PUNCH_REACH = TILE_SIZE * 1.4

/**
 * @param {import('./game-state.js').GameModel} model
 * @param {GameInput[]} inputs
 */
function tryPunchNearbyBlocks(model, inputs) {
  const level = model.levels[0]
  if (!level) return

  for (const player of model.players) {
    const input = inputs[player.index] ?? EMPTY_INPUT
    const edge = Boolean(input.punchBlock && !player.punchBlockPressed)
    player.punchBlockPressed = Boolean(input.punchBlock)
    if (!edge) continue

    const pcx = player.pos.x + player.size.x / 2
    const pcy = player.pos.y + player.size.y / 2
    let best
    let bestD = Infinity
    for (const o of level.objects) {
      if (o.collected) continue
      if (!INTERACTIVE_BLOCK_KINDS.has(o.kind)) continue
      if (o.activated) continue
      const b = getObjectBounds(o)
      const cx = b.left + b.width / 2
      const cy = b.top + b.height / 2
      const dx = Math.abs(cx - pcx)
      const dy = Math.abs(cy - pcy)
      if (dx > PUNCH_REACH || dy > PUNCH_REACH * 1.15) continue
      const d = dx * dx + dy * dy
      if (d < bestD) {
        bestD = d
        best = o
      }
    }
    if (!best) continue
    if (best.kind === "block_planks") best.collected = true
    else best.state = "hit_fire"
  }
}

/**
 * Animate flag sprites (Kenney flag_*_a / flag_*_b).
 *
 * @param {import('./game-state.js').GameModel} model
 */
function tickFlagSpritesInLevel(model) {
  const level = model.levels[0]
  if (!level) return
  const phase = Math.floor(model.elapsed * 8) % 2
  const suf = phase === 0 ? "a" : "b"
  for (const object of level.objects) {
    if (object.kind !== "flag" || object.collected) continue
    const sp = String(object.sprite ?? "")
    const m = /^flag_(\w+)_[ab]$/.exec(sp)
    if (m) object.sprite = `flag_${m[1]}_${suf}`
  }
}

/**
 * @param {import('./game-state.js').GameModel} model
 */
function tickCoinSpritesInLevel(model) {
  const level = model.levels[0]
  if (!level) return
  for (const object of level.objects) {
    if (object.kind !== "coin" || object.collected) continue
    const base = String(object.sprite ?? "coin_gold").replace(/_side$/, "")
    const phase = Math.floor(model.elapsed * 2.8) % 2 === 0
    object.sprite = phase ? base : `${base}_side`
  }
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
    savePlayerSkinsFromModel(model)
  }
  player.cycleSkinPressed = input.cycleSkin

  const ladder = findOverlappingLadder(model, player)
  player.onLadder = Boolean(ladder)

  const wantsClimb = input.jump || input.down
  if (player.onLadder && wantsClimb) {
    const axisX = Number(input.right) - Number(input.left)
    player.velocity.x = axisX * player.speed * 0.4
    const climb = Number(input.down) - Number(input.jump)
    player.velocity.y = climb * 300
    player.velocity.y += model.gravity * deltaTime * 0.15
    player.pos.x += player.velocity.x * deltaTime
    player.pos.y += player.velocity.y * deltaTime
    player.grounded = false
    player.pos.x = clamp(player.pos.x, 0, model.world.width - player.size.x)
    player.pos.y = clamp(player.pos.y, 0, model.world.height - player.size.y)
    return
  }

  const inWater = playerOverlapsFluidKind(model, player, "water")
  const inLava = playerOverlapsFluidKind(model, player, "lava")
  player.inWater = inWater
  if (inLava) {
    applyDamage(player, 1)
  }

  if (inWater) {
    const axisX = Number(input.right) - Number(input.left)
    player.velocity.x = axisX * player.speed * 0.45
    player.velocity.y += model.gravity * deltaTime * 0.2
    player.velocity.y -= 520 * deltaTime
    if (input.jump) player.velocity.y -= 380 * deltaTime
    if (input.down) player.velocity.y += 260 * deltaTime
    player.velocity.y = clamp(player.velocity.y, -200, 160)
    player.pos.x += player.velocity.x * deltaTime
    player.pos.y += player.velocity.y * deltaTime
    resolveTerrainCollisions(model, player)
    return
  }

  const axisX = Number(input.right) - Number(input.left)
  if (input.jump && player.grounded) {
    playSoundJump()
    player.velocity.y = -model.jumpSpeed
    player.grounded = false
  }

  player.velocity.x = axisX * player.speed
  player.velocity.y += model.gravity * deltaTime
  player.pos.x += player.velocity.x * deltaTime
  player.pos.y += player.velocity.y * deltaTime

  resolveTerrainCollisions(model, player)
}

const EMPTY_INPUT = Object.freeze(/** @type {GameInput} */ ({
  cycleSkin: false,
  down: false,
  jump: false,
  left: false,
  right: false,
  shoot: false,
  punchBlock: false,
  editorToggle: false,
  editorPlace: false,
  editorRemove: false,
  editorCycleNext: false,
  editorCyclePrev: false,
  editorCycleColor: false,
  editorCursorUp: false,
  editorCursorDown: false,
  editorCursorLeft: false,
  editorCursorRight: false,
  menuToggle: false,
}))

/**
 * @param {import('./game-state.js').GameModel} model
 * @param {GameActorData} player
 * @param {"water" | "lava"} kind
 */
function playerOverlapsFluidKind(model, player, kind) {
  const level = model.levels[0]
  if (!level) return false
  const left = Math.floor(player.pos.x / TILE_SIZE)
  const right = Math.floor((player.pos.x + player.size.x - 1) / TILE_SIZE)
  const top = Math.floor(player.pos.y / TILE_SIZE)
  const bottom = Math.floor((player.pos.y + player.size.y - 1) / TILE_SIZE)
  for (let ty = top; ty <= bottom; ty++) {
    for (let tx = left; tx <= right; tx++) {
      if (getFluidAtTile(level, tx, ty) === kind) return true
    }
  }
  return false
}

/**
 * @param {import('./game-state.js').GameModel} model
 * @param {number} dt
 */
function trySpawnFish(model, dt) {
  if (model.editorMode) return
  const level = model.levels[0]
  if (!level) return
  model._fishSpawnAccumulator += dt * 1000
  if (model._fishSpawnAccumulator < 5500) return
  model._fishSpawnAccumulator = 0
  const rows = level.layers.terrain
  const vr = level.layers.terrainVariant
  if (!rows?.length || !vr) return
  /** @type {{ x: number, y: number }[]} */
  const waterCells = []
  for (let y = 0; y < rows.length; y++) {
    const row = rows[y] ?? ""
    for (let x = 0; x < row.length; x++) {
      if (row[x] !== "0") continue
      const ch = vr[y]?.[x] ?? " "
      if (ch === "W") waterCells.push({ x, y })
    }
  }
  if (waterCells.length === 0) return
  if (Math.random() > 0.35) return
  const cell = waterCells[Math.floor(Math.random() * waterCells.length)]
  if (!cell) return
  const wx = (cell.x + 0.3 + Math.random() * 0.4) * TILE_SIZE
  const wy = (cell.y + 0.35) * TILE_SIZE
  level.objects.push({
    kind: "fish",
    x: cell.x,
    y: cell.y,
    width: 1,
    height: 1,
    solid: false,
    collected: false,
    sprite: "fish",
    fishX: wx,
    fishY: wy,
    fishVx: (Math.random() > 0.5 ? 1 : -1) * (55 + Math.random() * 40),
    fishLife: 2.2 + Math.random() * 1.8,
  })
}

/**
 * @param {import('./game-state.js').GameModel} model
 * @param {number} dt
 */
function updateFishDecorations(model, dt) {
  const level = model.levels[0]
  if (!level) return
  for (let i = level.objects.length - 1; i >= 0; i--) {
    const o = level.objects[i]
    if (!o || o.kind !== "fish") continue
    const fx = o.fishX ?? o.x * TILE_SIZE
    const fy = o.fishY ?? o.y * TILE_SIZE
    const vx = o.fishVx ?? 40
    o.fishX = fx + vx * dt
    o.fishY = fy + Math.sin(model.elapsed * 4 + i) * 12 * dt
    o.fishLife = (o.fishLife ?? 2) - dt
    if (o.fishLife <= 0) {
      level.objects.splice(i, 1)
    }
  }
}

/**
 * @param {import('./game-state.js').GameModel} model
 * @param {GameActorData} player
 * @returns {GameLevelObject | null}
 */
function findOverlappingLadder(model, player) {
  const level = model.levels[0]
  if (!level) return null

  for (const object of level.objects) {
    if (object.kind !== "ladder" || object.collected) continue
    if (isOverlapping(player, object)) {
      return object
    }
  }
  return null
}

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
export function resolveTerrainCollisions(model, player) {
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
    if (object.collected) continue
    if (
      object.kind !== "gem" &&
      object.kind !== "coin" &&
      object.kind !== "key"
    )
      continue

    for (const player of model.players) {
      if (!isOverlapping(player, object)) continue
      object.collected = true
      if (object.kind === "gem") {
        player.gems += 1
        playSoundGemPickup()
      } else if (object.kind === "coin") {
        player.coins += 1
        playSoundCoinPickup()
      } else if (object.kind === "key") {
        const keyColor = object.sprite?.replace("key_", "")
        if (keyColor) {
          player.keys[keyColor] = true
        }
        playSoundKeyPickup()
      }
      break
    }
  }
}

/**
 * Level objects use `object.y` as the bottom tile row (same as draw and
 * {@link resolveSolidOverlap}), not the top row.
 *
 * @param {GameLevelObject} object
 * @returns {{ left: number, top: number, width: number, height: number }}
 */
function getLevelObjectWorldBounds(object) {
  return getObjectBounds(object)
}

/**
 * @param {GameActorData} player
 * @param {GameLevelObject} object
 * @returns {boolean}
 */
function isOverlapping(player, object) {
  const b = getLevelObjectWorldBounds(object)

  return (
    player.pos.x < b.left + b.width &&
    player.pos.x + player.size.x > b.left &&
    player.pos.y < b.top + b.height &&
    player.pos.y + player.size.y > b.top
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

    const keyColor = object.sprite?.replace("lock_", "")

    for (const player of model.players) {
      if (
        keyColor &&
        player.keys[keyColor] &&
        canPlayerAdjacentUnlockLock(player, object)
      ) {
        player.keys[keyColor] = false
        object.collected = true
        playSoundBlockCoinOrLockOpen()
        removeLinkedColorBlocks(level, object, keyColor)
        updateLockRespawnPoint(model)
        savePlayerSkinsFromModel(model)
        break
      }
    }

    if (object.collected) continue

    for (const player of model.players) {
      if (!isOverlapping(player, object)) continue
      resolveSolidOverlap(player, object)
    }
  }
}

/**
 * Remove color blocks 4-connected to the lock with the same color.
 *
 * @param {GameLevel} level
 * @param {GameLevelObject} lock
 * @param {string} color
 */
function removeLinkedColorBlocks(level, lock, color) {
  const want = `block_${color}`
  const lockTiles = getObjectTileCells(lock)
  /** @type {GameLevelObject[]} */
  const seed = []

  for (const o of level.objects) {
    if (o.kind !== "color_block" || o.collected || o.sprite !== want) continue
    if (colorBlockTileAdjacentToAnyTile(o, lockTiles)) {
      seed.push(o)
    }
  }

  /** @type {Set<GameLevelObject>} */
  const visited = new Set()
  const stack = [...seed]
  while (stack.length > 0) {
    const o = stack.pop()
    if (!o || visited.has(o)) continue
    visited.add(o)
    for (const o2 of level.objects) {
      if (o2.kind !== "color_block" || o2.collected || o2.sprite !== want)
        continue
      if (visited.has(o2)) continue
      if (colorBlocksShareTileEdge(o, o2)) stack.push(o2)
    }
  }

  level.objects = level.objects.filter(
    (o) => !(o.kind === "color_block" && visited.has(o)),
  )
}

/**
 * @param {GameLevelObject} object
 * @returns {{ x: number, y: number }[]}
 */
function getObjectTileCells(object) {
  /** @type {{ x: number, y: number }[]} */
  const cells = []
  const top = object.y - object.height + 1
  for (let y = top; y <= object.y; y++) {
    for (let x = object.x; x < object.x + object.width; x++) {
      cells.push({ x, y })
    }
  }
  return cells
}

/**
 * @param {GameLevelObject} block
 * @param {{ x: number, y: number }[]} tiles
 */
function colorBlockTileAdjacentToAnyTile(block, tiles) {
  const cells = getObjectTileCells(block)
  for (const bc of cells) {
    for (const c of tiles) {
      if (Math.abs(bc.x - c.x) + Math.abs(bc.y - c.y) === 1) return true
    }
  }
  return false
}

/**
 * @param {GameLevelObject} a
 * @param {GameLevelObject} b
 */
function colorBlocksShareTileEdge(a, b) {
  const ac = getObjectTileCells(a)
  const bc = getObjectTileCells(b)
  for (const p of ac) {
    for (const q of bc) {
      if (Math.abs(p.x - q.x) + Math.abs(p.y - q.y) === 1) return true
    }
  }
  return false
}

/**
 * Unlock only when the player occupies at least one tile 4-adjacent to the
 * lock and does not overlap the lock footprint (stand next to it, not inside).
 *
 * @param {GameActorData} player
 * @param {GameLevelObject} lock
 */
function canPlayerAdjacentUnlockLock(player, lock) {
  const lockCells = getObjectTileCells(lock)
  const lockSet = new Set(lockCells.map((c) => `${c.x},${c.y}`))
  const playerCells = getActorTileCells(player)
  let overlaps = false
  let adjacent = false
  for (const pc of playerCells) {
    if (lockSet.has(`${pc.x},${pc.y}`)) overlaps = true
    for (const lc of lockCells) {
      if (Math.abs(pc.x - lc.x) + Math.abs(pc.y - lc.y) === 1) adjacent = true
    }
  }
  return adjacent && !overlaps
}

/**
 * Tiles the actor's hitbox occupies (for adjacency checks).
 *
 * @param {GameActorData} player
 */
function getActorTileCells(player) {
  const left = Math.floor(player.pos.x / TILE_SIZE)
  const right = Math.floor((player.pos.x + player.size.x - 1e-6) / TILE_SIZE)
  const top = Math.floor(player.pos.y / TILE_SIZE)
  const bottom = Math.floor((player.pos.y + player.size.y - 1e-6) / TILE_SIZE)
  /** @type {{ x: number, y: number }[]} */
  const cells = []
  for (let y = top; y <= bottom; y++) {
    for (let x = left; x <= right; x++) {
      cells.push({ x, y })
    }
  }
  return cells
}

/**
 * @param {import('./game-state.js').GameModel} model
 */
function tryExitDoorLevelTransition(model) {
  const level = model.levels[0]
  if (!level || !allColorLocksCleared(level)) return

  for (const object of level.objects) {
    if (object.kind !== "exit_door") continue

    for (const player of model.players) {
      if (!isOverlapping(player, object)) continue
      advanceToNextLevel(model)
      return
    }
  }
}

/**
 * @param {GameLevel} level
 * @returns {boolean}
 */
function allColorLocksCleared(level) {
  for (const object of level.objects) {
    if (object.kind === "lock" && !object.collected) {
      return false
    }
  }
  return true
}

/**
 * Update the current respawn point from the rightmost unlocked lock.
 *
 * @param {import('./game-state.js').GameModel} model
 */
function updateLockRespawnPoint(model) {
  const level = model.levels[0]
  if (!level) {
    model.lastUnlockedLockRespawn = null
    model.unlockedLocks = 0
    return
  }
  const unlocked = level.objects
    .filter((o) => o.kind === "lock" && o.collected)
    .sort((a, b) => a.x - b.x || a.y - b.y)
  model.unlockedLocks = unlocked.length
  const rightmost = unlocked[unlocked.length - 1]
  model.lastUnlockedLockRespawn = rightmost
    ? {
        x: (rightmost.x + 0.5) * TILE_SIZE,
        y: (rightmost.y + 0.5) * TILE_SIZE,
      }
    : null
}

/**
 * Restore unlock progress for the current level from a saved lock count.
 *
 * @param {import('./game-state.js').GameModel} model
 * @param {GameLevel} level
 * @param {number} unlockedCount
 */
export function applyUnlockedLocksToLevel(model, level, unlockedCount) {
  const locks = level.objects
    .filter((o) => o.kind === "lock")
    .sort((a, b) => a.x - b.x || a.y - b.y)
  const count = Math.max(0, Math.min(unlockedCount, locks.length))
  for (let i = 0; i < count; i++) {
    const lock = locks[i]
    if (!lock) continue
    lock.collected = true
    const keyColor = lock.sprite?.replace("lock_", "")
    if (keyColor) removeLinkedColorBlocks(level, lock, keyColor)
  }
  model.unlockedLocks = count
  updateLockRespawnPoint(model)
}

/**
 * Replace level 0 with a newly generated level and reset camera, editor, and spawns.
 *
 * @param {import('./game-state.js').GameModel} model
 * @param {number} seed
 */
export function regenerateLevelAtSeed(model, seed) {
  const nextLevel = generateLevel(seed)
  model.levels[0] = nextLevel
  model.currentLevelIndex = 0
  model.world.width = nextLevel.width * TILE_SIZE
  model.world.height = nextLevel.height * TILE_SIZE
  resetPlayersForNewLevel(model)
  model.camera.x = 0
  model.camera.y = 0
  model.editorMode = false
  model._editorPrevToggleAny = false
  model.terrainRevision = 0
  model.editorTileX = [4, 4]
  model.editorTileY = [4, 4]
  model.editorThingIndex = [0, 0]
  model.editorColorIndex = [0, 0]
  model.editorBiomeIndex = [0, 0]
  model.editorBlockVariantIndex = [0, 0]
  model.editorBridgeVariantIndex = [0, 0]
  model.editorRopeVariantIndex = [0, 0]
  model.editorRockVariantIndex = [0, 0]
  model.editorHazardVariantIndex = [0, 0]
  model.editorSpikeUpsideDown = [false, false]
  model.editorBrickVariantIndex = [0, 0]
  model.editorCoinVariantIndex = [0, 0]
  model.editorColorsById = [{}, {}]
  model._editorPrevPlace = [false, false]
  model._editorPrevRemove = [false, false]
  model._editorPrevUndo = [false, false]
  model._editorPrevLevelNext = [false, false]
  model._editorPrevLevelPrev = [false, false]
  model._editorPrevCycleNext = [false, false]
  model._editorPrevCyclePrev = [false, false]
  model._editorPrevColor = [false, false]
  model._editorPrevCursorUp = [false, false]
  model._editorPrevCursorDown = [false, false]
  model._editorPrevCursorLeft = [false, false]
  model._editorPrevCursorRight = [false, false]
  model.editorFluidIsLava = [false, false]
  model.editorConveyorDirIndex = [0, 0]
  model.editorCursorMovedThisFrame = [false, false]
  model._fishSpawnAccumulator = 0
  model.editLog = []
  model.unlockedLocks = 0
  model.lastUnlockedLockRespawn = null
  syncMusicModeToLevel(nextLevel)
  model.onProjectDirty?.()
}

/**
 * Regenerate level from the same seed and replay editor ops; players and editor
 * cursors stay in place (used from the editor toolbar).
 *
 * @param {import('./game-state.js').GameModel} model
 */
export function reloadLevelWithEditsPreserveEditor(model) {
  const prev = model.levels[0]
  if (!prev) return
  const seed = prev.generatedFrom.seed
  const ops = model.editLog ?? []
  const n = Math.min(model.players.length, 2)
  /** @type {{ px: number, py: number, ex: number, ey: number }[]} */
  const saved = []
  for (let i = 0; i < n; i++) {
    const p = model.players[i]
    if (!p) continue
    saved.push({
      px: p.pos.x,
      py: p.pos.y,
      ex: model.editorTileX[i] ?? 0,
      ey: model.editorTileY[i] ?? 0,
    })
  }
  const editorMode = model.editorMode
  const nextLevel = generateLevel(seed)
  applyEditInstructions(nextLevel, ops, model)
  model.levels[0] = nextLevel
  model.currentLevelIndex = 0
  model.world.width = nextLevel.width * TILE_SIZE
  model.world.height = nextLevel.height * TILE_SIZE
  model.terrainRevision += 1
  applyUnlockedLocksToLevel(model, nextLevel, model.unlockedLocks ?? 0)

  for (let i = 0; i < n; i++) {
    const p = model.players[i]
    const s = saved[i]
    if (p === undefined || s === undefined) continue
    p.pos.x = clamp(s.px, 0, model.world.width - p.size.x)
    p.pos.y = clamp(s.py, 0, model.world.height - p.size.y)
    p.oldPos.x = p.pos.x
    p.oldPos.y = p.pos.y
    p.velocity.x = 0
    p.velocity.y = 0
    model.editorTileX[i] = clamp(s.ex, 0, nextLevel.width - 1)
    model.editorTileY[i] = clamp(s.ey, 0, nextLevel.height - 1)
  }
  model.editorMode = editorMode
  updateLockRespawnPoint(model)
  syncMusicModeToLevel(nextLevel)
  model.onProjectDirty?.()
}

/**
 * Discard the last edit op, then reload current level from its seed + remaining ops.
 *
 * @param {import('./game-state.js').GameModel} model
 */
export function undoLastEditAndReload(model) {
  const level = model.levels[0]
  if (!level) return
  if (model.editLog?.length) model.editLog.pop()
  if (level.generatedFrom.ops?.length) level.generatedFrom.ops.pop()
  reloadLevelWithEditsPreserveEditor(model)
}

/**
 * Rotate the active level forward/backward, wrapping around the current project.
 *
 * @param {import('./game-state.js').GameModel} model
 * @param {1 | -1} direction
 */
export function cycleEditorLevel(model, direction) {
  const levels = model.levels
  const prev = levels[0]
  if (!prev) return
  const oldIndex = Number(model.currentLevelIndex ?? 0) || 0

  if (levels.length < 2) {
    const delta = direction > 0 ? 7919 : -7919
    const seed = (prev.generatedFrom.seed + delta + 1_000_000_000) % 1_000_000_000
    const nextLevel = generateLevel(seed)
    nextLevel.generatedFrom.ops = nextLevel.generatedFrom.ops ?? []
    if (direction > 0) {
      levels.push(nextLevel)
    } else {
      levels.unshift(nextLevel)
    }
  }

  const editorMode = model.editorMode
  const saved = model.players.slice(0, 2).map((p, i) => ({
    px: p?.pos.x ?? 0,
    py: p?.pos.y ?? 0,
    ex: model.editorTileX[i] ?? 0,
    ey: model.editorTileY[i] ?? 0,
  }))

  if (direction > 0) {
    levels.push(levels.shift())
  } else {
    levels.unshift(levels.pop())
  }

  const nextLevel = levels[0]
  if (!nextLevel) return

  for (const object of nextLevel.objects) {
    if (object.kind === "lock") object.collected = false
  }

  model.currentLevelIndex =
    (oldIndex + (direction > 0 ? 1 : -1) + levels.length) % levels.length
  model.world.width = nextLevel.width * TILE_SIZE
  model.world.height = nextLevel.height * TILE_SIZE
  model.terrainRevision += 1
  nextLevel.generatedFrom.ops = nextLevel.generatedFrom.ops ?? []
  model.editLog = nextLevel.generatedFrom.ops
  syncMusicModeToLevel(nextLevel)

  const count = Math.min(model.players.length, 2)
  for (let i = 0; i < count; i++) {
    const p = model.players[i]
    const s = saved[i]
    if (!p || !s) continue
    p.pos.x = clamp(s.px, 0, model.world.width - p.size.x)
    p.pos.y = clamp(s.py, 0, model.world.height - p.size.y)
    p.oldPos.x = p.pos.x
    p.oldPos.y = p.pos.y
    p.velocity.x = 0
    p.velocity.y = 0
    model.editorTileX[i] = clamp(s.ex, 0, nextLevel.width - 1)
    model.editorTileY[i] = clamp(s.ey, 0, nextLevel.height - 1)
  }

  model.editorMode = editorMode
  model.camera.x = 0
  model.camera.y = 0
  model.unlockedLocks = 0
  model.lastUnlockedLockRespawn = null
  for (const player of model.players) {
    player.keys = {
      blue: false,
      green: false,
      red: false,
      yellow: false,
    }
  }
  savePlayerSkinsFromModel(model)
  model.onProjectDirty?.()
}

/**
 * @param {import('./game-state.js').GameModel} model
 */
function advanceToNextLevel(model) {
  const prev = model.levels[0]
  if (!prev) return

  playSoundLevelComplete()

  const seed = (prev.generatedFrom.seed + 7919) % 1_000_000_000
  const nextLevel = generateLevel(seed)
  model.levels.unshift(nextLevel)
  model.currentLevelIndex = 0
  model.editLog = []
  model.world.width = nextLevel.width * TILE_SIZE
  model.world.height = nextLevel.height * TILE_SIZE
  resetPlayersForNewLevel(model)
  model.camera.x = 0
  model.camera.y = 0
  model.unlockedLocks = 0
  model.lastUnlockedLockRespawn = null
  for (const player of model.players) {
    player.keys = {
      blue: false,
      green: false,
      red: false,
      yellow: false,
    }
  }
  savePlayerSkinsFromModel(model)
  syncMusicModeToLevel(nextLevel)
  model.onProjectDirty?.()
}

/**
 * @param {GameActorData} player
 * @param {GameLevelObject} object
 */
function resolveSolidOverlap(player, object) {
  const { left, top, width, height } = getLevelObjectWorldBounds(object)
  const playerCenterY = player.pos.y + player.size.y / 2
  const objectCenterY = top + height / 2
  const overlapLeft = player.pos.x + player.size.x - left
  const overlapRight = left + width - player.pos.x
  const overlapTop = player.pos.y + player.size.y - top
  const overlapBottom = top + height - player.pos.y
  const minOverlap = Math.min(
    overlapLeft,
    overlapRight,
    overlapTop,
    overlapBottom,
  )

  if (minOverlap === overlapLeft) {
    player.pos.x = left - player.size.x
    if (player.velocity.x > 0) player.velocity.x = 0
    return
  }

  if (minOverlap === overlapRight) {
    player.pos.x = left + width
    if (player.velocity.x < 0) player.velocity.x = 0
    return
  }

  if (minOverlap === overlapTop || playerCenterY < objectCenterY) {
    player.pos.y = top - player.size.y
    if (player.velocity.y > 0) player.velocity.y = 0
    player.grounded = true
    return
  }

  if (minOverlap === overlapBottom || playerCenterY >= objectCenterY) {
    player.pos.y = top + height
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
