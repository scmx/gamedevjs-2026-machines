import {
  getConnectedGamepads,
  getInputs,
  hasPlayerTwoKeyboardInput,
} from "./game-controller.js"
import { draw } from "./game-draw.js"
import { syncPlayerCount } from "./game-state.js"
import { update } from "./game-update.js"

/**
 * @param {import('./game-state.js').GameModel} model
 * @param {import('./game-state.js').GameView} view
 * @param {GameKeyboard} keyboard
 * @param {{ loop?: (callback: FrameRequestCallback) => number }} [options]
 */
export function startGameLoop(model, view, keyboard, options = {}) {
  const { loop = requestAnimationFrame } = options

  let accumulator = 0
  let previousTime = performance.now()

  loop(function frame(now) {
    const frameTime = now - previousTime
    previousTime = now
    accumulator += frameTime

    model.frameTime = (accumulator % model.interval) / model.interval
    while (accumulator >= model.interval) {
      const gamepads = getConnectedGamepads()
      const needsSecondPlayer =
        gamepads.length > 1 ||
        hasPlayerTwoKeyboardInput(keyboard) ||
        model.players.length > 1
      syncPlayerCount(model, needsSecondPlayer ? 2 : 1)
      model.simulationTime += model.interval
      update(
        model,
        getInputs(keyboard, gamepads, model.editorMode),
        model.interval / 1000,
      )
      accumulator -= model.interval
    }

    draw(model, view)
    loop(frame)
  })
}
