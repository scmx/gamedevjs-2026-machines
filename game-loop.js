import { getInputs } from "./game-controller.js"
import { draw } from "./game-draw.js"
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
      model.simulationTime += model.interval
      update(model, getInputs(keyboard), model.interval / 1000)
      accumulator -= model.interval
    }

    draw(model, view)
    loop(frame)
  })
}
