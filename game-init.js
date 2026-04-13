import { createGameModel, createGameView } from "./game-state.js"
import { createKeyboard } from "./game-controller.js"
import { startGameLoop } from "./game-loop.js"
import { listen, resize } from "./game-dom.js"

/** @param {CanvasRenderingContext2D} ctx */
export default function init(ctx) {
  const model = createGameModel()
  const view = createGameView(ctx)
  const keyboard = createKeyboard()
  listen(view, keyboard)
  resize(view)
  startGameLoop(model, view, keyboard)
}
