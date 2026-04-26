import { exportEditLogJson, applyEditInstructions } from "./editor-edit-log.js"
import { randomLevelSeed } from "./editor-terrain.js"
import { setInputState } from "./game-controller.js"
import {
  cycleLevelMusicMode,
  getLevelMusicLabel,
  syncAudioLevelsToModel,
} from "./game-sounds.js"
import { generateLevel } from "./editor-terrain.js"
import {
  decodeOp,
  normalizeProjectLevels,
  formatProjectJson,
  serializeProjectLevels,
  PROJECT_FILE_NAME,
} from "./project-storage.js"
import {
  regenerateLevelAtSeed,
  undoLastEditAndReload,
  reloadLevelWithEditsPreserveEditor,
} from "./game-update.js"

/**
 * @param {import('./game-state.js').GameView} view
 * @param {GameKeyboard} keyboard
 */
export function listen(view, keyboard) {
  const addEventListener = globalThis.addEventListener

  addEventListener(
    "error",
    (event) => {
      console.error("[game] error", event.error ?? event.message)
    },
    true,
  )
  addEventListener("unhandledrejection", (event) => {
    console.error("[game] unhandledrejection", event.reason)
  })

  addEventListener("touchstart", preventTouchDefault, { passive: false })
  addEventListener("touchmove", preventTouchDefault, { passive: false })
  addEventListener("touchend", preventTouchDefault, { passive: false })
  addEventListener("touchcancel", preventTouchDefault, { passive: false })
  addEventListener("gesturestart", preventDefault, { passive: false })
  addEventListener("gesturechange", preventDefault, { passive: false })
  addEventListener("gestureend", preventDefault, { passive: false })
  addEventListener("contextmenu", preventDefault, { passive: false })
  addEventListener("selectstart", preventDefault, { passive: false })
  addEventListener("selectionchange", preventDefault, { passive: false })
  addEventListener("resize", () => resize(view))
  addEventListener("keydown", (event) => setInputState(event, keyboard, true))
  addEventListener("keyup", (event) => setInputState(event, keyboard, false))
}

/**
 * Keep the DOM menu in sync with model.menuOpen.
 *
 * @param {import('./game-state.js').GameModel} model
 */
export function syncMainMenuOverlay(model) {
  const menu = document.querySelector("#main_menu")
  if (!(menu instanceof HTMLElement)) return
  menu.hidden = !model.menuOpen

  const button = document.querySelector("#menu_button")
  if (button instanceof globalThis.HTMLButtonElement) {
    button.textContent = model.editorMode ? "Close" : "Menu"
  }
}

/**
 * Reflect editor state on the root element for CSS-driven visibility.
 *
 * @param {import('./game-state.js').GameModel} model
 */
export function syncEditorRootAttribute(model) {
  const root = document.documentElement
  if (model.editorMode) {
    root.dataset.editor = "open"
  } else {
    delete root.dataset.editor
  }
}

/**
 * Show editor-only toolbar controls only while in the editor.
 *
 * @param {import('./game-state.js').GameModel} model
 */
export function syncEditorToolbarVisibility(model) {
  const editorOnly = document.querySelectorAll("[data-editor-only='true']")
  for (const node of editorOnly) {
    if (!(node instanceof HTMLElement)) continue
    node.hidden = false
    node.style.removeProperty("display")
  }

  const autosave = document.querySelector("#autosave_button")
  if (autosave instanceof HTMLElement) {
    const fsApiAvailable = isFileSystemAccessApiAvailable()
    autosave.hidden = !fsApiAvailable
    if (!fsApiAvailable) autosave.style.display = "none"
    else autosave.style.removeProperty("display")
  }

  const restart = document.querySelector("#restart_button")
  if (restart instanceof HTMLElement) {
    restart.hidden = model.editorMode
  }
}

/**
 * @returns {boolean}
 */
function isFileSystemAccessApiAvailable() {
  return globalThis.isSecureContext && typeof globalThis.showDirectoryPicker === "function"
}

/** Max delay between pointer ups to count as a double-tap (mouse or touch). */
const SEED_DOUBLE_TAP_MS = 400

/**
 * Single tap: copy seed immediately (required for iOS Safari — clipboard must run in the user gesture).
 * Second tap within {@link SEED_DOUBLE_TAP_MS}: new random seed (no delayed clipboard).
 *
 * @param {import('./game-state.js').GameModel} model
 */
export function bindSeedButton(model) {
  const seedButton = document.querySelector("#seed_button")
  if (!(seedButton instanceof globalThis.HTMLButtonElement)) return

  const syncLabel = () => {
    const seed = model.levels[0]?.generatedFrom.seed ?? 0
    seedButton.textContent = `Seed ${seed}`
  }
  syncLabel()

  let lastPointerUpTime = 0

  seedButton.addEventListener("pointerup", (event) => {
    if (event.button > 0) return
    event.preventDefault()

    const now = performance.now()
    const elapsed = lastPointerUpTime > 0 ? now - lastPointerUpTime : Infinity

    if (lastPointerUpTime > 0 && elapsed < SEED_DOUBLE_TAP_MS) {
      lastPointerUpTime = 0
      const next = randomLevelSeed()
      regenerateLevelAtSeed(model, next)
      syncLabel()
      console.log("Rerolled level seed:", next)
      return
    }

    lastPointerUpTime = now
    const seed = model.levels[0]?.generatedFrom?.seed ?? 0
    console.log("Level seed:", seed)
    const clipboard = navigator.clipboard
    if (clipboard?.writeText) {
      void clipboard.writeText(String(seed)).then(
        () => {
          seedButton.textContent = "Seed Copied"
          globalThis.setTimeout(() => syncLabel(), 1200)
        },
        () => syncLabel(),
      )
    } else {
      syncLabel()
    }
  })
}

const SAVE_EDITS_LABEL = "Save edits (JSON)"

/**
 * Exports `{ seed, levelVersion, ops }`. Uses Web Share on capable mobile Safari; otherwise
 * synchronous blob download + clipboard copy on iOS (downloads are unreliable there).
 *
 * @param {import('./game-state.js').GameModel} model
 */
export function bindSaveExportButton(model) {
  const btn = document.querySelector("#save_edits_button")
  if (!(btn instanceof globalThis.HTMLButtonElement)) return

  btn.addEventListener("pointerup", (event) => {
    if (event.button > 0) return
    event.preventDefault()
    const json = formatProjectJson(serializeProjectLevels(model))
    if (model.projectDataDirHandle) {
      void exportProjectToFolder(model)
        .then(() => {
          btn.textContent = "Exported"
          globalThis.setTimeout(() => {
            btn.textContent = "Export"
          }, 1200)
        })
        .catch((err) => console.error(err))
      return
    }
    void mountThenExportProject(model, btn).catch((err) => console.error(err))
  })
}

/**
 * @param {string} json
 * @param {Blob} blob
 * @param {string} filename
 * @param {HTMLButtonElement} btn
 */
function syncDownloadLevelJson(json, blob, filename, btn) {
  const url = globalThis.URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.rel = "noopener"
  a.style.display = "none"
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  globalThis.URL.revokeObjectURL(url)

  const isIOS =
    /iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  if (isIOS) {
    const clipboard = navigator.clipboard
    if (clipboard?.writeText) {
      void clipboard.writeText(json).then(
        () => {
          btn.textContent = "JSON copied to clipboard"
          globalThis.setTimeout(() => {
            btn.textContent = SAVE_EDITS_LABEL
          }, 2200)
        },
        () => {},
      )
    }
  }
}

/**
 * Regenerate from seed + edit log without resetting player or editor cursor positions.
 *
 * @param {import('./game-state.js').GameModel} model
 */
export function bindReloadEditsButton(model) {
  const btn = document.querySelector("#reload_edits_button")
  if (!(btn instanceof globalThis.HTMLButtonElement)) return

  btn.addEventListener("pointerup", (event) => {
    if (event.button > 0) return
    event.preventDefault()
    reloadLevelWithEditsPreserveEditor(model)
  })
}

/**
 * Undo the last edit operation and then reload the level from the remaining log.
 *
 * @param {import('./game-state.js').GameModel} model
 */
export function bindUndoEditsButton(model) {
  const btn = document.querySelector("#undo_edits_button")
  if (!(btn instanceof globalThis.HTMLButtonElement)) return

  btn.addEventListener("pointerup", (event) => {
    if (event.button > 0) return
    event.preventDefault()
    undoLastEditAndReload(model)
  })
}

/**
 * Reload the page (pointerup so it matches Seed/Save on touch Safari).
 */
export function bindRestartButton() {
  const btn = document.querySelector("#restart_button")
  if (!(btn instanceof globalThis.HTMLButtonElement)) return

  btn.addEventListener("pointerup", (event) => {
    if (event.button > 0) return
    event.preventDefault()
    globalThis.location.reload()
  })
}

export function bindMenuButton(model) {
  const btn = document.querySelector("#menu_button")
  if (!(btn instanceof globalThis.HTMLButtonElement)) return
  btn.addEventListener("pointerup", (event) => {
    if (event.button > 0) return
    event.preventDefault()
    model.menuOpen = true
    model.editorMode = false
  })
}

/**
 * @param {import('./game-state.js').GameModel} model
 */
export function bindMainMenuButtons(model) {
  const resume = document.querySelector("#menu_resume_button")
  const editor = document.querySelector("#menu_editor_button")
  const music = document.querySelector("#menu_music_button")
  const sfx = document.querySelector("#menu_sfx_button")
  const restart = document.querySelector("#menu_restart_button")

  if (resume instanceof globalThis.HTMLButtonElement) {
    resume.addEventListener("pointerup", (event) => {
      if (event.button > 0) return
      event.preventDefault()
      model.menuOpen = false
    })
  }

  if (editor instanceof globalThis.HTMLButtonElement) {
    editor.addEventListener("pointerup", (event) => {
      if (event.button > 0) return
      event.preventDefault()
      model.menuOpen = false
      model.editorMode = true
    })
  }

  const syncAudioLabels = () => {
    const labels = ["Off", "Low", "Med", "High"]
    if (music instanceof globalThis.HTMLButtonElement) {
      music.textContent = `Music ${labels[model.musicVolume] ?? "High"}`
    }
    if (sfx instanceof globalThis.HTMLButtonElement) {
      sfx.textContent = `SFX ${labels[model.sfxVolume] ?? "High"}`
    }
  }
  syncAudioLabels()

  if (music instanceof globalThis.HTMLButtonElement) {
    music.addEventListener("pointerup", (event) => {
      if (event.button > 0) return
      event.preventDefault()
      model.musicVolume = /** @type {0 | 1 | 2 | 3} */ ((model.musicVolume + 1) % 4)
      syncAudioLevelsToModel(model)
      syncAudioLabels()
    })
  }

  if (sfx instanceof globalThis.HTMLButtonElement) {
    sfx.addEventListener("pointerup", (event) => {
      if (event.button > 0) return
      event.preventDefault()
      model.sfxVolume = /** @type {0 | 1 | 2 | 3} */ ((model.sfxVolume + 1) % 4)
      syncAudioLevelsToModel(model)
      syncAudioLabels()
    })
  }

  if (restart instanceof globalThis.HTMLButtonElement) {
    restart.addEventListener("pointerup", (event) => {
      if (event.button > 0) return
      event.preventDefault()
      globalThis.location.reload()
    })
  }
}

export function bindMountButton(model) {
  const btn = document.querySelector("#mount_button")
  if (!(btn instanceof globalThis.HTMLButtonElement)) return
  btn.addEventListener("pointerup", async (event) => {
    if (event.button > 0) return
    event.preventDefault()
    try {
      await mountProjectFolder(model)
      btn.textContent = "Mounted"
    } catch (err) {
      console.error(err)
    }
  })
}

export function bindImportButton(model) {
  const btn = document.querySelector("#import_button")
  if (!(btn instanceof globalThis.HTMLButtonElement)) return
  btn.addEventListener("pointerup", async (event) => {
    if (event.button > 0) return
    event.preventDefault()
    try {
      await importProjectFromFolder(model)
    } catch (err) {
      console.error(err)
    }
  })
}

export function bindAutoSaveButton(model) {
  const btn = document.querySelector("#autosave_button")
  if (!(btn instanceof globalThis.HTMLButtonElement)) return
  const sync = () => {
    btn.textContent = `Auto-save ${model.projectAutoSave ? "ON" : "OFF"}`
  }
  sync()
  btn.addEventListener("pointerup", (event) => {
    if (event.button > 0) return
    event.preventDefault()
    model.projectAutoSave = !model.projectAutoSave
    sync()
  })
}

export function bindMusicButton(model) {
  const btn = document.querySelector("#music_button")
  if (!(btn instanceof globalThis.HTMLButtonElement)) return

  const syncLabel = () => {
    btn.textContent = getLevelMusicLabel(model.levels[0])
  }
  syncLabel()

  btn.addEventListener("pointerup", (event) => {
    if (event.button > 0) return
    event.preventDefault()
    cycleLevelMusicMode(model.levels[0])
    syncLabel()
  })
}

export async function mountProjectFolder(model) {
  if (!globalThis.isSecureContext) {
    throw new Error("File System Access API requires HTTPS or localhost")
  }
  const picker = globalThis.showDirectoryPicker
  if (typeof picker !== "function") throw new Error("File System Access API unavailable")
  const dir = await picker({ mode: "readwrite" })
  model.projectDataDirHandle = dir
  model.projectAutoSave = true
  await syncProjectLevelsFromFolder(model)
  return dir
}

/**
 * Prompt for a folder, then export the current project into it.
 *
 * @param {import('./game-state.js').GameModel} model
 * @param {HTMLButtonElement} btn
 */
export async function mountThenExportProject(model, btn) {
  if (!globalThis.isSecureContext) {
    throw new Error("File System Access API requires HTTPS or localhost")
  }
  const picker = globalThis.showDirectoryPicker
  if (typeof picker !== "function") throw new Error("File System Access API unavailable")
  const dir = await picker({ mode: "readwrite" })
  model.projectDataDirHandle = dir
  model.projectAutoSave = true
  await exportProjectToFolder(model)
  btn.textContent = "Exported"
  globalThis.setTimeout(() => {
    btn.textContent = "Export"
  }, 1200)
}

export async function importProjectFromFolder(model) {
  if (!globalThis.isSecureContext) {
    throw new Error("File System Access API requires HTTPS or localhost")
  }
  await syncProjectLevelsFromFolder(model)
}

export async function exportProjectToFolder(model) {
  const dir = model.projectDataDirHandle
  if (!dir) throw new Error("No data folder mounted")
  const fileHandle = await dir.getFileHandle(PROJECT_FILE_NAME, { create: true })
  const writable = await fileHandle.createWritable()
  await writable.write(formatProjectJson(serializeProjectLevels(model)))
  await writable.close()
}

export async function syncProjectLevelsFromFolder(model) {
  const dir = model.projectDataDirHandle
  if (!dir) return
  try {
    const fileHandle = await dir.getFileHandle(PROJECT_FILE_NAME)
    const file = await fileHandle.getFile()
    const text = await file.text()
    const parsed = JSON.parse(text)
    const records = normalizeProjectLevels(parsed.levels ?? parsed)
    if (!records.length) return
    const levels = []
    for (const record of records) {
      const level = generateLevel(record.seed)
      const ops = (record.ops ?? []).map(decodeOp).filter(Boolean)
      applyEditInstructions(level, ops, model)
      if (record.music) level.generatedFrom.music = record.music
      level.generatedFrom.ops = ops
      levels.push(level)
    }
    model.levels = levels
    model.projectAutoSave = true
    model.onProjectDirty?.()
  } catch {
    /* ignore missing levels.json */
  }
}

/** @param {import('./game-state.js').GameView} view */
export function resize(
  view,
  w = innerWidth,
  h = innerHeight,
  dpr = devicePixelRatio || 1,
) {
  view.scale = Math.min(w / 960, h / 540)

  resizeCanvas(view.ctx.back, dpr, w, h)
  resizeCanvas(view.ctx.tiles, dpr, w, h)
  resizeCanvas(view.ctx.objects, dpr, w, h)
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} dpr
 * @param {number} width
 * @param {number} height
 */
export function resizeCanvas(ctx, dpr, width, height) {
  ctx.canvas.width = width * dpr
  ctx.canvas.height = height * dpr
  ctx.canvas.style.width = `${width}px`
  ctx.canvas.style.height = `${height}px`

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.imageSmoothingEnabled = false
}

/**
 * Block scroll/zoom gestures on the game surface. Mobile Safari will not
 * synthesize `click` for buttons if we always call `preventDefault()` on
 * touch events, so allow default handling for the toolbar (Restart, Seed, etc.).
 *
 * @param {TouchEvent} event
 */
function preventTouchDefault(event) {
  const t = event.target
  if (t instanceof Element && t.closest(".game_toolbar")) return
  event.preventDefault()
}

/**
 * @param {Event} event
 */
function preventDefault(event) {
  event.preventDefault()
}
