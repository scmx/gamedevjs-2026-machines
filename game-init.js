import { createGameModel, createGameView } from "./game-state.js"
import { createKeyboard } from "./game-controller.js"
import { startGameLoop } from "./game-loop.js"
import { bindSeedButton, listen, resize } from "./game-dom.js"
import { generateLevel } from "./editor-terrain.js"
import { getImagePathsUsed } from "./game-draw.js"

/**
 * @param {HTMLCanvasElement} back
 * @param {HTMLCanvasElement} tiles
 * @param {HTMLCanvasElement} objects
 */
export default function init(back, tiles, objects) {
  if (!back || !tiles || !objects) throw new Error("Missing required canvases")

  addEventListener("load", () => {
    const level = generateLevel(357762530)
    const model = createGameModel({ levels: [level] })
    window.MODEL = model
    const view = createGameView(back, tiles, objects)
    console.log(getImagePathsUsed().join("\n"))
    const keyboard = createKeyboard()
    bindSeedButton(level.generatedFrom.seed)
    listen(view, keyboard)
    resize(view)
    startGameLoop(model, view, keyboard)
  })
}
