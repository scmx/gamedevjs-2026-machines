import { createGameModel, createGameView } from "./game-state.js"
import { createKeyboard } from "./game-controller.js"
import { startGameLoop } from "./game-loop.js"
import { listen, resize } from "./game-dom.js"
import { generateLevel } from "./editor-terrain.js"

/** @param {CanvasRenderingContext2D} ctx */
export default function init(ctx) {
  addEventListener("load", () => {
    const level = generateLevel()
    const model = createGameModel({ levels: [level] })
    const view = createGameView(ctx)
    const keyboard = createKeyboard()
    listen(view, keyboard)
    resize(view)
    startGameLoop(model, view, keyboard)
  })
}
