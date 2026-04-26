import {
  getConnectedGamepads,
  getInputs,
  hasPlayerTwoKeyboardInput,
} from "./game-controller.js"
import { draw } from "./game-draw.js"
import { resumeZzfxAudioIfGamepadActive } from "./game-sounds.js"
import { syncPlayerCount } from "./game-state.js"
import { update } from "./game-update.js"
import {
  syncEditorToolbarVisibility,
  syncEditorRootAttribute,
  syncMainMenuOverlay,
} from "./game-dom.js"

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
    try {
      const frameTime = now - previousTime
      previousTime = now
      accumulator += frameTime

      model.frameTime = (accumulator % model.interval) / model.interval
      while (accumulator >= model.interval) {
        const gamepads = getConnectedGamepads()
        resumeZzfxAudioIfGamepadActive(gamepads)
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

      syncMainMenuOverlay(model)
      syncEditorRootAttribute(model)
      syncEditorToolbarVisibility(model)
      draw(model, view)
    } catch (err) {
      console.error("[game] frame error", err)
    }
    loop(frame)
  })
}
