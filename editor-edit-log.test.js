import assert from "node:assert/strict"
import test from "node:test"
import { applyEditInstructions, EDIT_LOG_FORMAT_VERSION } from "./editor-edit-log.js"

test("applyEditInstructions toggles terrain and adds objects", () => {
  /** @type {GameLevel} */
  const level = {
    id: "t",
    name: "t",
    width: 8,
    height: 4,
    layers: {
      terrain: ["00000000", "00000000", "11111111", "11111111"],
      terrainVariant: ["        ", "        ", "gggggggg", "gggggggg"],
    },
    objects: [],
    generatedFrom: { version: 7, seed: 42 },
  }

  const ops = [
    { op: "terrainToggle", x: 2, y: 2, biomeChar: "g" },
    {
      op: "objectAdd",
      obj: {
        kind: "coin",
        x: 3,
        y: 1,
        width: 1,
        height: 1,
        sprite: "coin_gold",
        collected: false,
      },
    },
    { op: "objectRemoveTile", tx: 3, ty: 1 },
  ]

  applyEditInstructions(level, ops)

  assert.equal(level.layers.terrain[2]?.[2], "1")
  assert.equal(level.objects.length, 0)
})

test("EDIT_LOG_FORMAT_VERSION is stable", () => {
  assert.equal(EDIT_LOG_FORMAT_VERSION, 1)
})
