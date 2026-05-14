import test from "node:test"
import assert from "node:assert/strict"

import { trySwitches, updateFallingObjects } from "./game-entities.js"
import { TILE_SIZE, createGameModel, createPlayer } from "./game-state.js"

test("color blocks stay put when unsupported and still toggle on switches", () => {
  /** @type {GameLevelObject & { vy?: number }} */
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
  /** @type {GameLevelObject} */
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
  const model = createGameModel({
    levels: [
      {
        id: "test",
        name: "test",
        width: 10,
        height: 12,
        objects: [block, sw],
        layers: {
          terrain: Array.from({ length: 12 }, () => "0000000000"),
          terrainVariant: Array.from({ length: 12 }, () => "          "),
        },
        generatedFrom: { version: 1, seed: 0 },
      },
    ],
  })

  updateFallingObjects(model, 1 / 60)
  assert.equal(block.y, 5)
  assert.equal(block.vy, undefined)

  const player = createPlayer(0, 6 * TILE_SIZE, 5 * TILE_SIZE, "#fff", "beige")
  model.players.push(player)

  trySwitches(model)
  assert.equal(block.solid, false)

  updateFallingObjects(model, 1 / 60)
  assert.equal(block.y, 5)
  assert.equal(block.vy, undefined)
})
