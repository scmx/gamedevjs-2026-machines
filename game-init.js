import { applySkinPrefsToPlayers, loadPlayerPrefs } from "./game-prefs.js"
import { createGameModel, createGameView } from "./game-state.js"
import { createKeyboard } from "./game-controller.js"
import { startGameLoop } from "./game-loop.js"
import {
  bindMenuButton,
  bindReloadEditsButton,
  bindUndoEditsButton,
  bindMountButton,
  bindImportButton,
  bindAutoSaveButton,
  bindMainMenuButtons,
  bindRestartButton,
  bindSaveExportButton,
  bindSeedButton,
  bindMusicButton,
  listen,
  resize,
} from "./game-dom.js"
import { generateLevel } from "./editor-terrain.js"
import { applyEditInstructions } from "./editor-edit-log.js"
import { getImagePathsUsed } from "./game-draw.js"
import {
  installZzfxAudioUnlockListeners,
  syncAudioLevelsToModel,
} from "./game-sounds.js"
import { applyUnlockedLocksToLevel } from "./game-update.js"
import { exportProjectToFolder } from "./game-dom.js"
import { decodeOp, normalizeProjectLevels } from "./project-storage.js"

/**
 * @param {HTMLCanvasElement} back
 * @param {HTMLCanvasElement} tiles
 * @param {HTMLCanvasElement} objects
 */
export default function init(back, tiles, objects) {
  if (!back || !tiles || !objects) throw new Error("Missing required canvases")

  addEventListener("load", () => {
    void boot(back, tiles, objects).catch((err) => console.error(err))
  })
}

async function boot(back, tiles, objects) {
  installZzfxAudioUnlockListeners()
  const levels = await loadInitialLevels()
  const model = createGameModel({ levels })
  const prefs = loadPlayerPrefs()
  if (prefs) applySkinPrefsToPlayers(model.players, prefs)
  applySavedProgress(model, prefs)
  syncAudioLevelsToModel(model)
  let saveTimer = 0
  model.projectAutoSave = false
  model.projectDataDirHandle = null
  model.onProjectDirty = () => {
    if (!model.projectAutoSave || !model.projectDataDirHandle) return
    globalThis.clearTimeout(saveTimer)
    saveTimer = globalThis.setTimeout(() => {
      void exportProjectToFolder(model).catch((err) => console.error(err))
    }, 200)
  }
  window.MODEL = model
  const view = createGameView(back, tiles, objects)
  console.log(getImagePathsUsed().join("\n"))
  const keyboard = createKeyboard()
  bindSeedButton(model)
  bindMusicButton(model)
  bindMenuButton(model)
  bindMountButton(model)
  bindImportButton(model)
  bindAutoSaveButton(model)
  bindMainMenuButtons(model)
  bindSaveExportButton(model)
  bindReloadEditsButton(model)
  bindUndoEditsButton(model)
  bindRestartButton()
  listen(view, keyboard)
  resize(view)
  startGameLoop(model, view, keyboard)
}

/**
 * @param {import('./game-state.js').GameModel} model
 * @param {ReturnType<typeof loadPlayerPrefs>} prefs
 */
function applySavedProgress(model, prefs) {
  const levelIndex = Math.max(0, prefs?.levelIndex ?? 0)
  const unlockedLocks = Math.max(0, prefs?.unlockedLocks ?? 0)
  if (model.levels.length > 1 && levelIndex > 0) {
    const steps = levelIndex % model.levels.length
    for (let i = 0; i < steps; i++) {
      model.levels.push(model.levels.shift())
    }
  }
  model.currentLevelIndex = levelIndex % Math.max(model.levels.length, 1)
  model.unlockedLocks = unlockedLocks
  if (model.levels[0]) {
    applyUnlockedLocksToLevel(model, model.levels[0], unlockedLocks)
  }
  if (unlockedLocks > 0 && model.lastUnlockedLockRespawn) {
    for (const player of model.players) {
      player.pos.x = model.lastUnlockedLockRespawn.x
      player.pos.y = model.lastUnlockedLockRespawn.y
      player.oldPos.x = player.pos.x
      player.oldPos.y = player.pos.y
      player.velocity.x = 0
      player.velocity.y = 0
      player.grounded = false
    }
  }
}

async function loadInitialLevels() {
  try {
    const response = await fetch("./data/levels.json")
    if (!response.ok) throw new Error(`Failed to load levels.json: ${response.status}`)
    const parsed = await response.json()
    const records = normalizeProjectLevels(parsed.levels ?? parsed)
    if (!records.length) throw new Error("No levels in levels.json")
    return records.map((record) => {
      const level = generateLevel(record.seed)
      const ops = (record.ops ?? []).map(decodeOp).filter(Boolean)
      applyEditInstructions(level, ops)
      if (record.music) level.generatedFrom.music = record.music
      level.generatedFrom.ops = ops
      return level
    })
  } catch {
    return [generateLevel(608308260)]
  }
}
