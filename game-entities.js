import { playPlayerHurtRumble } from "./game-controller.js"
import {
  playSoundBlockCoinOrLockOpen,
  playSoundExplosion,
  playSoundPlayerHurt,
  playSoundSpringJump,
} from "./game-sounds.js"
import { TILE_SIZE } from "./game-state.js"

const HURT_COOLDOWN = 0.65
const FIREBALL_SPEED = 420
const CONVEYOR_ACCEL = 620
const BOMB_FUSE = 1.2
const FALL_GRAVITY = 2400
const BOMB_ARM_IMPACT_SPEED = 220
const SWITCH_RANGE_TILES = 12

/** Block kinds that react to player step / fireballs. @type {ReadonlySet<string>} */
export const INTERACTIVE_BLOCK_KINDS = new Set([
  "block_coin",
  "block_exclamation",
  "block_strong_exclamation",
  "block_strong_danger",
  "block_planks",
])

/**
 * @param {GameActorData} player
 * @param {number} halfHearts
 */
export function applyDamage(player, halfHearts) {
  if (player.hurtCooldown > 0) return
  player.heartHalves = Math.max(0, player.heartHalves - halfHearts)
  player.hearts = Math.ceil(player.heartHalves / 2)
  player.hurtCooldown = HURT_COOLDOWN
  playSoundPlayerHurt()
  playPlayerHurtRumble(player.index)
}

/**
 * @param {import('./game-state.js').GameModel} model
 * @param {number} dt
 */
export function tickHurtCooldowns(model, dt) {
  for (const player of model.players) {
    if (player.hurtCooldown > 0) player.hurtCooldown -= dt
  }
}

/**
 * @param {GameLevelObject} object
 * @returns {{ left: number, top: number, width: number, height: number }}
 */
export function getObjectBounds(object) {
  const left = object.x * TILE_SIZE
  const width = object.width * TILE_SIZE
  const topOfBottomRow = object.y * TILE_SIZE
  const top = topOfBottomRow - (object.height - 1) * TILE_SIZE
  const height = object.height * TILE_SIZE
  return { left, top, width, height }
}

/**
 * @param {GameActorData} player
 * @param {GameLevelObject} object
 */
function overlap(player, object) {
  const b = getObjectBounds(object)
  return (
    player.pos.x < b.left + b.width &&
    player.pos.x + player.size.x > b.left &&
    player.pos.y < b.top + b.height &&
    player.pos.y + player.size.y > b.top
  )
}

/**
 * @param {GameLevel} level
 */
function allLocksOpen(level) {
  for (const object of level.objects) {
    if (object.kind === "lock" && !object.collected) return false
  }
  return true
}

/**
 * @param {import('./game-state.js').GameModel} model
 */
export function resolveSolidNonLockObjects(model) {
  const level = model.levels[0]
  if (!level) return
  const doorLocked = !allLocksOpen(level)

  for (const object of level.objects) {
    if (object.collected || object.solid !== true) continue
    if (object.kind === "lock") continue
    if (object.kind === "exit_door" && !doorLocked) continue

    for (const player of model.players) {
      if (!overlap(player, object)) continue
      resolvePushOut(player, object)
    }
  }
}

/**
 * @param {GameActorData} player
 * @param {GameLevelObject} object
 */
function resolvePushOut(player, object) {
  const { left, top, width, height } = getObjectBounds(object)
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
 * @param {GameLevelObject} o
 * @param {GameLevelObject} belt
 * @returns {boolean}
 */
function pickupOnConveyorSurface(o, belt) {
  if (!overlapRectObjects(o, belt)) return false
  const b = getObjectBounds(belt)
  const ob = getObjectBounds(o)
  const feet = ob.top + ob.height
  return feet >= b.top - 4 && feet <= b.top + TILE_SIZE * 0.45
}

/** @param {GameLevelObject} belt */
function conveyorDirSign(belt) {
  return Number(belt.state ?? 1) >= 0 ? 1 : -1
}

/**
 * Merged column spans [L,R] for conveyors on one row with matching travel direction.
 *
 * @param {GameLevel} level
 * @param {number} cy
 * @param {number} dirSign
 * @returns {[number, number][]}
 */
function mergeConveyorIntervals(level, cy, dirSign) {
  /** @type {[number, number][]} */
  const raw = []
  for (const o of level.objects) {
    if (o.kind !== "conveyor" || o.collected || o.solid !== true) continue
    if (o.y !== cy) continue
    if (conveyorDirSign(o) !== dirSign) continue
    raw.push([o.x, o.x + o.width - 1])
  }
  raw.sort((a, b) => a[0] - b[0])
  /** @type {[number, number][]} */
  const merged = []
  for (const pair of raw) {
    const L = pair[0] ?? 0
    const R = pair[1] ?? L
    const prev = merged[merged.length - 1]
    if (!prev || L > (prev[1] ?? 0) + 1) merged.push([L, R])
    else prev[1] = Math.max(prev[1] ?? 0, R)
  }
  return merged
}

/**
 * World X span [t0,t1): belt columns plus the next tile downstream so items slide into it.
 *
 * @param {number} runMin
 * @param {number} runMax
 * @param {number} dirSign
 */
function conveyorSlideTrackXWorld(runMin, runMax, dirSign) {
  if (dirSign > 0) {
    return { t0: runMin * TILE_SIZE, t1: (runMax + 2) * TILE_SIZE }
  }
  return { t0: (runMin - 1) * TILE_SIZE, t1: (runMax + 1) * TILE_SIZE }
}

/**
 * @param {number} left
 * @param {number} right
 * @param {number} t0
 * @param {number} t1
 */
function horizontalSpanOverlaps(left, right, t0, t1) {
  return left < t1 && right > t0
}

/**
 * @param {GameActorData} player
 * @param {GameLevelObject} belt
 */
function playerFeetAlignedWithConveyorTop(player, belt) {
  const b = getObjectBounds(belt)
  const feet = player.pos.y + player.size.y
  return feet >= b.top - 4 && feet <= b.top + TILE_SIZE * 0.45
}

/**
 * Feet on conveyor plane (same row) — no horizontal overlap required (exit tile / slide).
 *
 * @param {GameLevelObject} o
 * @param {GameLevelObject} belt
 */
function feetAlignedWithConveyorTopPlane(o, belt) {
  const b = getObjectBounds(belt)
  const ob = getObjectBounds(o)
  const feet = ob.top + ob.height
  return feet >= b.top - 4 && feet <= b.top + TILE_SIZE * 0.45
}

/**
 * @param {import('./game-state.js').GameModel} model
 * @param {GameLevelObject} o
 */
function findConveyorRunForObject(model, o) {
  const level = model.levels[0]
  if (!level) return null
  const ob = getObjectBounds(o)
  const obLeft = ob.left
  const obRight = ob.left + ob.width

  for (const belt of level.objects) {
    if (belt.kind !== "conveyor" || belt.collected || belt.solid !== true) continue
    if (!feetAlignedWithConveyorTopPlane(o, belt)) continue
    const dir = conveyorDirSign(belt)
    const cy = belt.y
    const runs = mergeConveyorIntervals(level, cy, dir)
    for (const run of runs) {
      const L = run[0] ?? 0
      const R = run[1] ?? L
      const { t0, t1 } = conveyorSlideTrackXWorld(L, R, dir)
      if (horizontalSpanOverlaps(obLeft, obRight, t0, t1)) {
        return { runMin: L, runMax: R, cy, dir }
      }
    }
  }
  return null
}

/**
 * @param {import('./game-state.js').GameModel} model
 * @param {GameActorData} player
 */
function findConveyorRunForPlayer(model, player) {
  const level = model.levels[0]
  if (!level) return null
  const pLeft = player.pos.x
  const pRight = player.pos.x + player.size.x
  for (const belt of level.objects) {
    if (belt.kind !== "conveyor" || belt.collected || belt.solid !== true) continue
    if (!playerFeetAlignedWithConveyorTop(player, belt)) continue
    const dir = conveyorDirSign(belt)
    const cy = belt.y
    const runs = mergeConveyorIntervals(level, cy, dir)
    for (const run of runs) {
      const L = run[0] ?? 0
      const R = run[1] ?? L
      const { t0, t1 } = conveyorSlideTrackXWorld(L, R, dir)
      if (horizontalSpanOverlaps(pLeft, pRight, t0, t1)) {
        return { runMin: L, runMax: R, cy, dir }
      }
    }
  }
  return null
}

/**
 * @param {import('./game-state.js').GameModel} model
 * @param {GameLevelObject} o
 */
function objectRestsOnConveyor(model, o) {
  const level = model.levels[0]
  if (!level) return false
  for (const belt of level.objects) {
    if (belt.kind !== "conveyor" || belt.collected) continue
    if (belt.solid !== true) continue
    if (pickupOnConveyorSurface(o, belt)) return true
  }
  return false
}

/**
 * Pickups, bombs, and solid block variants slide on conveyor belts.
 *
 * @param {GameLevelObject} o
 */
function objectRidesConveyor(o) {
  if (o.collected) return false
  if (
    o.kind === "coin" ||
    o.kind === "gem" ||
    o.kind === "key" ||
    o.kind === "bomb"
  ) {
    return true
  }
  if (o.solid !== true) return false
  if (o.kind === "color_block") return true
  if (typeof o.kind === "string" && o.kind.startsWith("block_")) return true
  return false
}

/**
 * Move players and loose pickups along conveyor belts when standing on top.
 * Player uses position delta (not velocity) so movement survives the next frame's
 * input reset in {@link updatePlayer}.
 *
 * @param {import('./game-state.js').GameModel} model
 * @param {number} dt
 * @param {(m: import('./game-state.js').GameModel, p: GameActorData) => void} [resolvePlayerTerrain]
 */
export function applyConveyorBelts(model, dt, resolvePlayerTerrain) {
  const level = model.levels[0]
  if (!level) return
  const nudge = CONVEYOR_ACCEL * dt

  for (const player of model.players) {
    if (!player.grounded) continue
    const run = findConveyorRunForPlayer(model, player)
    if (!run) continue
    player.pos.x += run.dir * nudge
    if (resolvePlayerTerrain) resolvePlayerTerrain(model, player)
  }

  for (const o of level.objects) {
    if (!objectRidesConveyor(o)) continue
    const run = findConveyorRunForObject(model, o)
    if (!run) continue
    o.x += (run.dir * CONVEYOR_ACCEL * dt) / TILE_SIZE
  }
}

/**
 * @param {GameLevelObject} a
 * @param {GameLevelObject} b
 */
function overlapRectObjects(a, b) {
  const ba = getObjectBounds(a)
  const bb = getObjectBounds(b)
  return (
    ba.left < bb.left + bb.width &&
    ba.left + ba.width > bb.left &&
    ba.top < bb.top + bb.height &&
    ba.top + ba.height > bb.top
  )
}

/**
 * @param {import('./game-state.js').GameModel} model
 * @param {number} jumpSpeed
 */
export function applySprings(model, jumpSpeed) {
  const level = model.levels[0]
  if (!level) return

  for (const object of level.objects) {
    if (object.kind !== "spring" || object.collected) continue
    const b = getObjectBounds(object)
    for (const player of model.players) {
      if (!overlap(player, object)) continue
      if (player.velocity.y <= 0) continue
      const land =
        player.pos.y + player.size.y <= b.top + TILE_SIZE * 0.55 &&
        player.pos.y + player.size.y >= b.top - 2
      if (!land) continue
      player.velocity.y = -jumpSpeed * 1.35
      player.pos.y = b.top - player.size.y
      object.sprite = "spring_out"
      object.timer = 0.2
      playSoundSpringJump()
    }
  }
}

/**
 * @param {import('./game-state.js').GameModel} model
 * @param {number} dt
 */
export function tickSpringSprites(model, dt) {
  const level = model.levels[0]
  if (!level) return
  for (const object of level.objects) {
    if (object.kind !== "spring" || object.sprite !== "spring_out") continue
    const t = (object.timer ?? 0) - dt
    object.timer = t
    if (t <= 0) {
      object.sprite = "spring"
      delete object.timer
    }
  }
}

/**
 * @param {import('./game-state.js').GameModel} model
 */
export function applySpikesAndSaws(model) {
  const level = model.levels[0]
  if (!level) return

  for (const object of level.objects) {
    if (object.collected) continue
    if (
      object.kind !== "spikes" &&
      object.kind !== "saw" &&
      object.kind !== "cactus"
    )
      continue

    for (const player of model.players) {
      if (!overlap(player, object)) continue
      const b = getObjectBounds(object)
      const playerBottom = player.pos.y + player.size.y
      const halfwayY = b.top + b.height * 0.5
      const bounce =
        (object.kind === "spikes" ||
          object.kind === "cactus" ||
          object.sprite === "block_spikes") &&
        player.velocity.y > 0 &&
        playerBottom >= halfwayY
      if (bounce) {
        player.velocity.y = -520 * 0.48
      }
      applyDamage(player, 1)
    }
  }
}

/**
 * @param {import('./game-state.js').GameModel} model
 */
export function updateSawAngles(model) {
  const level = model.levels[0]
  if (!level) return
  const t = model.elapsed * 4
  for (const object of level.objects) {
    if (object.kind !== "saw" || object.collected) continue
    object.state = String(t % (Math.PI * 2))
  }
}

/**
 * @param {import('./game-state.js').GameModel} model
 */
export function trySwitches(model) {
  const level = model.levels[0]
  if (!level) return

  for (const sw of level.objects) {
    if (sw.kind !== "switch") continue
    let stepped = false
    for (const player of model.players) {
      if (overlap(player, sw)) stepped = true
    }

    const was = Boolean(sw["_prevStepped"])
    sw["_prevStepped"] = stepped

    const color = (sw.sprite ?? "")
      .replace("switch_", "")
      .replace("_pressed", "")
    if (!color || !["blue", "green", "red", "yellow"].includes(color)) continue

    sw.sprite = stepped ? `switch_${color}_pressed` : `switch_${color}`

    if (stepped && !was) {
      const target = findNearestColorBlock(level, sw.x, sw.y, color)
      if (target) {
        target.solid = target.solid === false
      }
    }
  }
}

/**
 * @param {GameLevel} level
 * @param {number} sx
 * @param {number} sy
 * @param {string} color
 * @returns {GameLevelObject | undefined}
 */
function findNearestColorBlock(level, sx, sy, color) {
  let best
  let bestD = SWITCH_RANGE_TILES * SWITCH_RANGE_TILES
  const want = `block_${color}`

  for (const o of level.objects) {
    if (o.kind !== "color_block" || o.collected) continue
    if (o.sprite !== want) continue
    const dx = o.x - sx
    const dy = o.y - sy
    const d = dx * dx + dy * dy
    if (d < bestD) {
      bestD = d
      best = o
    }
  }
  return best
}

/**
 * @param {GameLevelObject} o
 */
function armBombFromPlaceable(o) {
  o.kind = "bomb_entity"
  o.timer = BOMB_FUSE
  o.sprite = "bomb"
  o.solid = false
  delete o.vy
}

/**
 * @param {GameLevelObject} o
 */
function isFallable(o) {
  if (o.collected) return false
  if (o.kind === "bomb_entity") return false
  if (o.kind === "bomb") return true
  if (o.kind === "spikes" && o.sprite === "block_spikes") return true
  if (o.solid !== true) return false
  if (o.kind === "color_block") return false
  if (
    typeof o.kind === "string" &&
    o.kind.startsWith("block_") &&
    !["block_red", "block_yellow", "block_blue", "block_green"].includes(
      o.sprite ?? "",
    )
  ) {
    return true
  }
  return false
}

/**
 * Terrain under the object’s footprint, world bottom, or another solid’s **top** supporting it
 * so blocks stack and only fall when nothing remains below.
 *
 * @param {import('./game-state.js').GameModel} model
 * @param {GameLevelObject} o
 */
function fallableHasSupport(model, o) {
  const level = model.levels[0]
  if (!level) return true
  const terrain = level.layers.terrain
  const h = terrain.length
  const br = Math.floor(o.y + 0.001)
  const bw = o.width ?? 1
  const fLeft = Math.floor(o.x + 0.001)
  const fRight = fLeft + bw - 1
  const below = br + 1
  if (below >= h) return true
  if (terrain[below]) {
    const row = terrain[below]
    const rowLen = row?.length ?? 0
    for (let cx = fLeft; cx <= fRight; cx++) {
      if (cx >= 0 && cx < rowLen && row[cx] === "1") return true
    }
  }
  for (const oo of level.objects) {
    if (oo === o || oo.collected) continue
    if (oo.solid !== true) continue
    if (oo.kind === "bomb" || oo.kind === "bomb_entity") continue
    const left = oo.x
    const right = oo.x + oo.width - 1
    if (fRight < left || fLeft > right) continue
    if (br === oo.y - oo.height) return true
  }
  return false
}

/**
 * Snap fallable Y so it rests on terrain or flush on another solid’s top face.
 *
 * @param {import('./game-state.js').GameModel} model
 * @param {GameLevelObject} o
 */
function snapFallableY(model, o) {
  const level = model.levels[0]
  if (!level) return
  const oh = o.height ?? 1
  const bw = o.width ?? 1
  const fLeft = Math.floor(o.x + 0.001)
  const fRight = fLeft + bw - 1
  const br = Math.floor(o.y + 0.001)
  const terrain = level.layers.terrain
  const th = terrain.length
  const below = br + 1

  if (below < th && terrain[below]) {
    const row = terrain[below]
    const rowLen = row?.length ?? 0
    for (let cx = fLeft; cx <= fRight; cx++) {
      if (cx >= 0 && cx < rowLen && row[cx] === "1") {
        o.y = br
        return
      }
    }
  }

  for (const oo of level.objects) {
    if (oo === o || oo.collected) continue
    if (oo.solid !== true) continue
    if (oo.kind === "bomb" || oo.kind === "bomb_entity") continue
    const left = oo.x
    const right = oo.x + oo.width - 1
    if (fRight < left || fLeft > right) continue
    if (br === oo.y - oo.height) {
      o.y = oo.y - oh
      return
    }
  }
}

/**
 * Gravity for loose bombs and block-spike props when terrain below is removed.
 *
 * @param {import('./game-state.js').GameModel} model
 * @param {number} dt
 */
export function updateFallingObjects(model, dt) {
  const level = model.levels[0]
  if (!level) return

  for (const o of level.objects) {
    if (o.collected) continue
    if (!isFallable(o)) continue
    if (o.kind === "bomb_entity") continue

    if (o.vy === undefined) o.vy = 0

    if (fallableHasSupport(model, o)) {
      snapFallableY(model, o)
      o.vy = 0
      continue
    }

    o.vy += FALL_GRAVITY * dt
    o.y += (o.vy * dt) / TILE_SIZE

    if (fallableHasSupport(model, o)) {
      const landed = Math.abs(o.vy)
      snapFallableY(model, o)
      o.vy = 0
      if (
        o.kind === "bomb" &&
        landed >= BOMB_ARM_IMPACT_SPEED &&
        !objectRestsOnConveyor(model, o)
      ) {
        armBombFromPlaceable(o)
      }
    }
  }
}

/**
 * @param {import('./game-state.js').GameModel} model
 * @param {number} dt
 */
export function updateInteractiveBlocks(model, dt) {
  const level = model.levels[0]
  if (!level) return

  for (const object of level.objects) {
    if (object.collected) continue

    if (object.kind === "bomb") {
      for (const player of model.players) {
        if (!overlap(player, object)) continue
        const b = getObjectBounds(object)
        if (
          player.velocity.y > 80 &&
          player.pos.y + player.size.y <= b.top + TILE_SIZE * 0.55
        ) {
          armBombFromPlaceable(object)
          break
        }
      }
      continue
    }

    if (object.kind === "bomb_entity") {
      const fuse = (object.timer ?? BOMB_FUSE) - dt
      object.timer = fuse
      object.sprite =
        fuse < BOMB_FUSE * 0.35 && Math.floor(model.elapsed * 12) % 2 === 0
          ? "bomb_active"
          : "bomb"
      if (fuse <= 0) {
        explodeBomb(model, object)
        object.collected = true
      }
      continue
    }

    if (INTERACTIVE_BLOCK_KINDS.has(object.kind)) {
      handleInteractiveBlock(model, object)
    }
  }
}

/**
 * @param {import('./game-state.js').GameModel} model
 * @param {GameLevelObject} object
 */
function handleInteractiveBlock(model, object) {
  if (object.activated) return

  const stepped = anyPlayerOnTop(model, object)
  const hitFire = object.state === "hit_fire"

  if (object.kind === "block_planks") {
    if (stepped || hitFire) {
      object.collected = true
    }
    if (object.state === "hit_fire") delete object.state
    return
  }

  if (!stepped && !hitFire) {
    if (object.state === "hit_fire") delete object.state
    return
  }

  object.activated = true

  if (object.kind === "block_coin") {
    playSoundBlockCoinOrLockOpen()
    object.sprite = "block_coin_active"
    spawnCoinPickup(model, object.x, object.y - 1)
    object.sprite = "block_empty"
    object.kind = "decoration"
    object.solid = false
    return
  }

  if (object.kind === "block_exclamation") {
    object.sprite = "block_exclamation_active"
    const y = object.y * TILE_SIZE - TILE_SIZE * 0.5
    spawnFireball(model, object.x * TILE_SIZE + 4, y, -1)
    spawnFireball(model, object.x * TILE_SIZE + TILE_SIZE - 4, y, 1)
    object.sprite = "block_empty_warning"
    object.kind = "decoration"
    object.solid = false
    return
  }

  if (object.kind === "block_strong_exclamation") {
    object.sprite = "block_spikes"
    object.kind = "spikes"
    object.solid = false
    object.activated = false
    return
  }

  if (object.kind === "block_strong_danger") {
    object.sprite = "bomb"
    object.kind = "bomb_entity"
    object.timer = BOMB_FUSE
    object.solid = false
    object.activated = false
    return
  }
}

/**
 * @param {import('./game-state.js').GameModel} model
 * @param {GameLevelObject} object
 */
function anyPlayerOnTop(model, object) {
  const b = getObjectBounds(object)
  const top = b.top
  const tol = TILE_SIZE * 0.35
  for (const player of model.players) {
    if (!overlap(player, object)) continue
    const feet = player.pos.y + player.size.y
    if (feet > top + tol || feet < top - 6) continue
    if (player.velocity.y < -180) continue
    return true
  }
  return false
}

/**
 * @param {import('./game-state.js').GameModel} model
 * @param {number} tx
 * @param {number} ty
 */
function spawnCoinPickup(model, tx, ty) {
  const level = model.levels[0]
  if (!level) return
  level.objects.push({
    kind: "coin",
    x: tx,
    y: ty,
    width: 1,
    height: 1,
    sprite: "coin_gold",
    collected: false,
  })
}

/**
 * @param {import('./game-state.js').GameModel} model
 * @param {number} worldX
 * @param {number} worldY
 * @param {number} dir
 */
export function spawnFireball(model, worldX, worldY, dir) {
  const level = model.levels[0]
  if (!level) return
  level.objects.push({
    kind: "fireball",
    x: worldX / TILE_SIZE,
    y: worldY / TILE_SIZE,
    width: 1,
    height: 1,
    sprite: "fireball",
    vx: dir * FIREBALL_SPEED,
    vy: 0,
    solid: false,
    collected: false,
  })
}

/**
 * @param {import('./game-state.js').GameModel} model
 * @param {GameLevelObject} bomb
 */
function explodeBomb(model, bomb) {
  const level = model.levels[0]
  if (!level) return

  playSoundExplosion()

  const cx = bomb.x
  const cy = bomb.y

  const terrain = level.layers.terrain
  const variant = level.layers.terrainVariant
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const tx = cx + dx
      const ty = cy + dy
      if (ty < 0 || ty >= terrain.length) continue
      const row = terrain[ty]
      if (!row || tx < 0 || tx >= row.length) continue
      const chars = row.split("")
      if (chars[tx] === "1") {
        chars[tx] = "0"
        terrain[ty] = chars.join("")
        if (variant?.[ty]) {
          const vr = variant[ty].split("")
          if (vr[tx] !== undefined) vr[tx] = " "
          variant[ty] = vr.join("")
        }
      }
    }
  }

  model.terrainRevision += 1

  const left = (cx - 1) * TILE_SIZE
  const top = (cy - 1) * TILE_SIZE
  const size = TILE_SIZE * 3

  level.objects = level.objects.filter((o) => {
    if (o === bomb) return false
    if (o.collected) return true
    if (o.kind === "lock" || o.kind === "exit_door" || o.kind === "key")
      return true
    const b = getObjectBounds(o)
    const overlap =
      b.left < left + size &&
      b.left + b.width > left &&
      b.top < top + size &&
      b.top + b.height > top
    return !overlap
  })
}

/**
 * @param {import('./game-state.js').GameModel} model
 * @param {number} dt
 */
export function updateFireballs(model, dt) {
  const level = model.levels[0]
  if (!level) return

  const toRemove = new Set()
  const terrain = level.layers.terrain

  for (const object of level.objects) {
    if (object.kind !== "fireball" || object.collected) continue
    const vx = object.vx ?? 0
    object.x += (vx * dt) / TILE_SIZE
    object.y += ((object.vy ?? 0) * dt) / TILE_SIZE

    const tx = Math.floor(object.x + 0.5)
    const ty = Math.floor(object.y + 0.5)
    if (ty >= 0 && ty < terrain.length) {
      const row = terrain[ty]
      if (row?.[tx] === "1") {
        toRemove.add(object)
        continue
      }
    }

    const wx = object.x * TILE_SIZE
    const wy = object.y * TILE_SIZE
    for (const o of level.objects) {
      if (o === object || o.collected) continue
      if (o.kind === "fireball") continue
      const b = getObjectBounds(o)
      if (
        wx + TILE_SIZE * 0.2 < b.left + b.width &&
        wx + TILE_SIZE * 0.8 > b.left &&
        wy + TILE_SIZE * 0.2 < b.top + b.height &&
        wy + TILE_SIZE * 0.8 > b.top
      ) {
        if (o.kind === "bomb") {
          armBombFromPlaceable(o)
          toRemove.add(object)
          break
        }
        const solidHit = o.solid === true
        const fireTarget =
          INTERACTIVE_BLOCK_KINDS.has(o.kind) || o.kind === "block_planks"
        if (!solidHit && !fireTarget) continue

        if (INTERACTIVE_BLOCK_KINDS.has(o.kind)) {
          o.state = "hit_fire"
        }
        if (o.kind === "block_planks") {
          o.collected = true
        }
        toRemove.add(object)
        break
      }
    }

    if (object.x < -1 || object.x > level.width + 1) toRemove.add(object)
  }

  if (toRemove.size === 0) return
  level.objects = level.objects.filter((o) => !toRemove.has(o))
}
