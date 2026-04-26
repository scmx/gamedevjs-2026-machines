import test from "node:test"
import assert from "node:assert/strict"

import { trySwitches, updateFallingObjects } from "./game-entities.js"
import { TILE_SIZE } from "./game-state.js"

test("color blocks stay put when unsupported and still toggle on switches", () => {
  const block = {
    kind: "color_block",
    x: 5,
    y: 5,
    width: 1,
    height: 1,
    solid: true,
    sprite: "block_blue",
    collected: false,
  }
  const sw = {
    kind: "switch",
    x: 6,
    y: 5,
    width: 1,
    height: 1,
    solid: false,
    sprite: "switch_blue",
    collected: false,
  }
  const model = {
    elapsed: 0,
    players: [],
    levels: [
      {
        objects: [block, sw],
        layers: {
          terrain: Array.from({ length: 12 }, () => "0000000000"),
        },
      },
    ],
  }

  updateFallingObjects(model, 1 / 60)
  assert.equal(block.y, 5)
  assert.equal(block.vy, undefined)

  model.players.push({
    pos: { x: 6 * TILE_SIZE, y: 4.5 * TILE_SIZE },
    size: { x: TILE_SIZE, y: TILE_SIZE },
    velocity: { x: 0, y: 0 },
  })

  trySwitches(model)
  assert.equal(block.solid, false)

  updateFallingObjects(model, 1 / 60)
  assert.equal(block.y, 5)
  assert.equal(block.vy, undefined)
})
