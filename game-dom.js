import { setInputState } from "./game-controller.js"

/**
 * @param {import('./game-state.js').GameView} view
 * @param {GameKeyboard} keyboard
 */
export function listen(view, keyboard) {
  const addEventListener = globalThis.addEventListener
  const restart_button = document.querySelector("#restart_button")

  addEventListener("touchstart", preventDefault, { passive: false })
  addEventListener("touchmove", preventDefault, { passive: false })
  addEventListener("touchend", preventDefault, { passive: false })
  addEventListener("touchcancel", preventDefault, { passive: false })
  addEventListener("gesturestart", preventDefault, { passive: false })
  addEventListener("gesturechange", preventDefault, { passive: false })
  addEventListener("gestureend", preventDefault, { passive: false })
  addEventListener("contextmenu", preventDefault, { passive: false })
  addEventListener("selectstart", preventDefault, { passive: false })
  addEventListener("selectionchange", preventDefault, { passive: false })
  addEventListener("resize", () => resize(view))
  addEventListener("keydown", (event) => setInputState(event, keyboard, true))
  addEventListener("keyup", (event) => setInputState(event, keyboard, false))
  restart_button?.addEventListener("pointerup", (event) => {
    event.preventDefault()
    location.reload()
  })
}

/**
 * @param {number} seed
 */
export function bindSeedButton(seed) {
  const seedButton = document.querySelector("#seed_button")
  if (!(seedButton instanceof globalThis.HTMLButtonElement)) return

  seedButton.textContent = `Seed ${seed}`
  seedButton.addEventListener("pointerup", async (event) => {
    event.preventDefault()
    console.log("Level seed:", seed)

    try {
      await navigator.clipboard.writeText(String(seed))
      seedButton.textContent = "Seed Copied"
      globalThis.setTimeout(() => {
        seedButton.textContent = `Seed ${seed}`
      }, 1200)
    } catch {
      seedButton.textContent = `Seed ${seed}`
    }
  })
}

/** @param {import('./game-state.js').GameView} view */
export function resize(view) {
  const width = view.ctx.canvas.clientWidth
  const height = view.ctx.canvas.clientHeight
  const dpr = window.devicePixelRatio || 1
  const { canvas } = view.ctx

  canvas.width = width * dpr
  canvas.height = height * dpr
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`

  const ctx = view.ctx
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.imageSmoothingEnabled = false
  view.scale = Math.min(width / 960, height / 540)
}

/**
 * @param {Event} event
 */
function preventDefault(event) {
  event.preventDefault()
}
