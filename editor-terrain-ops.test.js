import assert from "node:assert/strict"
import test from "node:test"
import { applyTerrainToggle } from "./editor-terrain-ops.js"

test("hill-style toggle sets one cell variant without flooding neighbors", () => {
  /** @type {GameLevel} */
  const level = {
    id: "t",
    name: "t",
    width: 5,
    height: 2,
    layers: {
      terrain: ["11111", "11111"],
      terrainVariant: ["ggggg", "ggggg"],
    },
    objects: [],
    generatedFrom: { version: 1, seed: 0 },
  }
  const ok = applyTerrainToggle(level, 2, 0, "h", { flood: false })
  assert.equal(ok, true)
  assert.equal(level.layers.terrainVariant[0], "gghgg")
  assert.equal(level.layers.terrainVariant[1], "ggggg")
})

test("terrain tool still flood-fills connected solids with biome", () => {
  /** @type {GameLevel} */
  const level = {
    id: "t",
    name: "t",
    width: 5,
    height: 2,
    layers: {
      terrain: ["11111", "11111"],
      terrainVariant: ["ggggg", "sssss"],
    },
    objects: [],
    generatedFrom: { version: 1, seed: 0 },
  }
  applyTerrainToggle(level, 2, 0, "s", { flood: true })
  assert.equal(level.layers.terrainVariant[0], "sssss")
  assert.equal(level.layers.terrainVariant[1], "sssss")
})
