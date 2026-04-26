const GAMEPAD_AXIS_DEADZONE = 0.25
const TRIGGER_PRESS = 0.45
const ACTIONS = ["up", "left", "down", "right", "action", "interact"]
const KEYS = {
  p1: {
    up: "ArrowUp",
    left: "ArrowLeft",
    down: "ArrowDown",
    right: "ArrowRight",
    action: "KeyK",
    interact: "KeyJ",
    cycleSkin: "KeyL",
    menu: "KeyP",
  },
  p2: {
    up: "KeyW",
    left: "KeyA",
    down: "KeyS",
    right: "KeyD",
    action: "KeyG",
    interact: "KeyF",
    cycleSkin: "KeyQ",
    menu: "KeyP",
  },
}
const EDITOR_KEYS = {
  toggle: "KeyO",
  menu: "KeyP",
  place: "KeyF",
  remove: ["KeyV", "Delete", "Backspace"],
  levelNext: "KeyK",
  levelPrev: "KeyJ",
  cycleNext: "KeyC",
  cyclePrev: "KeyZ",
  cycleColor: "KeyX",
  cycleAltColor: "KeyQ",
  cursorUp: "ArrowUp",
  cursorDown: "ArrowDown",
  cursorLeft: "ArrowLeft",
  cursorRight: "ArrowRight",
}

/**
 * @param {GameKeyboard} keyboard
 * @param {string | string[]} key
 * @returns {boolean}
 */
function isKeyPressed(keyboard, key) {
  return Array.isArray(key)
    ? key.some((code) => Boolean(keyboard[code]))
    : Boolean(keyboard[key])
}

/** @type {GameInput} */
const EMPTY_INPUT = Object.freeze(/** @type {GameInput} */ ({
  cycleSkin: false,
  down: false,
  jump: false,
  left: false,
  right: false,
  shoot: false,
  punchBlock: false,
  editorToggle: false,
  editorPlace: false,
  editorRemove: false,
  editorUndo: false,
  editorLevelNext: false,
  editorLevelPrev: false,
  editorCycleNext: false,
  editorCyclePrev: false,
  editorCycleColor: false,
  editorCursorUp: false,
  editorCursorDown: false,
  editorCursorLeft: false,
  editorCursorRight: false,
  menuToggle: false,
}))

/** @returns {GameKeyboard} */
export function createKeyboard() {
  const keyboard = Object.create(null)
  for (const code of Object.values(KEYS.p1)) keyboard[code] = false
  for (const code of Object.values(KEYS.p2)) keyboard[code] = false
  for (const code of Object.values(EDITOR_KEYS)) {
    if (Array.isArray(code)) {
      for (const nested of code) keyboard[nested] = false
      continue
    }
    keyboard[code] = false
  }
  return keyboard
}

/**
 * @param {GameKeyboard} keyboard
 * @param {(Gamepad | null)[]} [gamepads]
 * @param {boolean} [editorMode]
 * @returns {GameInput[]}
 */
export function getInputs(
  keyboard,
  gamepads = navigator.getGamepads(),
  editorMode = false,
) {
  const menuToggle = Boolean(keyboard[EDITOR_KEYS.menu])
  const p1 = mergeInputs(
    getPlayerOneKeyboardInput(keyboard, editorMode),
    getConnectedGamepadInput(gamepads, 0, editorMode),
  )
  if (editorMode) {
    p1.cycleSkin = false
    p1.shoot = false
    p1.punchBlock = false
    p1.jump = false
    p1.left = false
    p1.right = false
    p1.down = false
  }

  const p2 = editorMode
    ? EMPTY_INPUT
    : mergeInputs(
        getPlayerTwoKeyboardInput(keyboard, editorMode),
        getConnectedGamepadInput(gamepads, 1, editorMode),
      )
  p1.menuToggle = p1.menuToggle || menuToggle

  return [p1, p2]
}

/**
 * @param {(Gamepad | null)[]} [gamepads]
 * @returns {Gamepad[]}
 */
export function getConnectedGamepads(gamepads = navigator.getGamepads()) {
  /** @type {Gamepad[]} */
  const connectedGamepads = []

  for (const gamepad of gamepads) {
    if (!gamepad?.connected) continue
    connectedGamepads.push(gamepad)
  }

  return connectedGamepads
}

/**
 * Fresh snapshot from {@link navigator.getGamepads} — required on some browsers for haptics
 * to run (stale handles after hurt logic may not drive motors).
 *
 * @param {Gamepad | null | undefined} gamepad
 * @returns {Gamepad | null}
 */
function freshGamepad(gamepad) {
  if (!gamepad?.connected) return null
  const list = navigator.getGamepads()
  const next = list[gamepad.index]
  return next?.connected ? next : gamepad
}

/**
 * Fallback when `vibrationActuator.playEffect("dual-rumble")` is missing or rejects
 * (Firefox-style {@link Gamepad#hapticActuators}, or unsupported effect).
 *
 * @param {Gamepad} gamepad
 * @param {number} durationMs
 */
function playGamepadHapticPulse(gamepad, durationMs) {
  const hs = gamepad.hapticActuators
  if (!hs?.length) return
  for (const h of hs) {
    if (h && typeof h.pulse === "function") {
      void Promise.resolve(h.pulse(1, durationMs)).catch(() => {})
    }
  }
}

/** Ms — long enough for Xbox / DS4 drivers to notice; playEffect rejects if duration is 0. */
const HURT_RUMBLE_MS = 110

/**
 * Short rumble when a player takes damage.
 * Prefer `vibrationActuator.playEffect("dual-rumble")`; fall back to `hapticActuators.pulse`.
 *
 * @param {number} playerIndex
 */
export function playPlayerHurtRumble(playerIndex) {
  const raw = getConnectedGamepads()[playerIndex]
  const gamepad = raw ? freshGamepad(raw) : null
  if (!gamepad?.connected) return

  const params = {
    startDelay: 0,
    duration: HURT_RUMBLE_MS,
    weakMagnitude: 0.95,
    strongMagnitude: 0.95,
  }

  const va = gamepad.vibrationActuator
  if (va && typeof va.playEffect === "function") {
    void Promise.resolve(va.playEffect("dual-rumble", params)).catch(() => {
      playGamepadHapticPulse(gamepad, HURT_RUMBLE_MS)
    })
    return
  }

  playGamepadHapticPulse(gamepad, HURT_RUMBLE_MS)
}

/**
 * @param {KeyboardEvent} event
 * @param {GameKeyboard} keyboard
 * @param {boolean} pressed
 */
export function setInputState(event, keyboard, pressed) {
  if (!Object.hasOwn(keyboard, event.code)) return
  event.preventDefault()
  keyboard[event.code] = pressed
}

/**
 * @param {GameKeyboard} keyboard
 * @param {boolean} editorMode
 * @returns {GameInput}
 */
function getPlayerOneKeyboardInput(keyboard, editorMode) {
  if (editorMode) {
    return {
      cycleSkin: false,
      shoot: false,
      punchBlock: false,
      down: false,
      jump: false,
      left: false,
      right: false,
      editorToggle: isKeyPressed(keyboard, EDITOR_KEYS.toggle),
      editorPlace: isKeyPressed(keyboard, EDITOR_KEYS.place),
      editorRemove: isKeyPressed(keyboard, EDITOR_KEYS.remove),
      editorUndo: false,
      editorLevelNext: isKeyPressed(keyboard, EDITOR_KEYS.levelNext),
      editorLevelPrev: isKeyPressed(keyboard, EDITOR_KEYS.levelPrev),
      editorCycleNext: isKeyPressed(keyboard, EDITOR_KEYS.cycleNext),
      editorCyclePrev: isKeyPressed(keyboard, EDITOR_KEYS.cyclePrev),
      editorCycleColor: isKeyPressed(keyboard, EDITOR_KEYS.cycleColor),
      editorCursorUp: isKeyPressed(keyboard, EDITOR_KEYS.cursorUp),
      editorCursorDown: isKeyPressed(keyboard, EDITOR_KEYS.cursorDown),
      editorCursorLeft: isKeyPressed(keyboard, EDITOR_KEYS.cursorLeft),
      editorCursorRight: isKeyPressed(keyboard, EDITOR_KEYS.cursorRight),
      menuToggle: false,
    }
  }

  return {
    cycleSkin: Boolean(keyboard[KEYS.p1.cycleSkin]),
    shoot: Boolean(keyboard[KEYS.p1.action]),
    punchBlock: Boolean(keyboard[KEYS.p1.interact]),
    down: Boolean(keyboard[KEYS.p1.down]),
    jump: Boolean(keyboard[KEYS.p1.up]),
    left: Boolean(keyboard[KEYS.p1.left]),
    right: Boolean(keyboard[KEYS.p1.right]),
    editorToggle: Boolean(keyboard[EDITOR_KEYS.toggle]),
    editorPlace: false,
    editorRemove: false,
    editorCycleNext: false,
    editorCyclePrev: false,
    editorCycleColor: false,
    editorCursorUp: false,
    editorCursorDown: false,
    editorCursorLeft: false,
    editorCursorRight: false,
    menuToggle: false,
  }
}

/**
 * Player 2 only exists for gameplay.
 *
 * @param {GameKeyboard} keyboard
 * @returns {GameInput}
 */
function getPlayerTwoKeyboardInput(keyboard) {
  return {
    cycleSkin: Boolean(keyboard[KEYS.p2.cycleSkin]),
    shoot: Boolean(keyboard[KEYS.p2.action]),
    punchBlock: Boolean(keyboard[KEYS.p2.interact]),
    jump: Boolean(keyboard[KEYS.p2.up]),
    left: Boolean(keyboard[KEYS.p2.left]),
    down: Boolean(keyboard[KEYS.p2.down]),
    right: Boolean(keyboard[KEYS.p2.right]),
    editorToggle: false,
    editorPlace: false,
    editorRemove: false,
    editorUndo: false,
    editorLevelNext: false,
    editorLevelPrev: false,
    editorCycleNext: false,
    editorCyclePrev: false,
    editorCycleColor: false,
    editorCursorUp: false,
    editorCursorDown: false,
    editorCursorLeft: false,
    editorCursorRight: false,
    menuToggle: false,
  }
}

/**
 * PlayStation Cross (×) is buttons[0]; Xbox "X" is buttons[2]; Y is buttons[3].
 * Do not treat generic buttons[0] as variant on Xbox — that is A.
 *
 * @param {Gamepad} gamepad
 */
function isPlayStationStyleGamepad(gamepad) {
  const id = gamepad.id ?? ""
  return /054c|0ce6|Sony|DualShock|DualSense|PlayStation/i.test(id)
}

/**
 * @param {Gamepad} gamepad
 * @returns {GameInput}
 */
function getEditorGamepadInput(gamepad) {
  const lt = gamepad.buttons[6]?.value ?? 0
  const rt = gamepad.buttons[7]?.value ?? 0
  const viewButton = gamepad.buttons[8]
  const menuButton = gamepad.buttons[9]
  const editorCycleVariant =
    isPressed(gamepad.buttons[3]) ||
    isPressed(gamepad.buttons[2]) ||
    (isPlayStationStyleGamepad(gamepad) && isPressed(gamepad.buttons[0]))
  return {
    cycleSkin: false,
    shoot: false,
    punchBlock: false,
    down: false,
    jump: false,
    left: false,
    right: false,
    editorCycleColor: editorCycleVariant,
    editorToggle: isPressed(viewButton),
    menuToggle: isPressed(menuButton),
    editorPlace: lt > TRIGGER_PRESS,
    editorRemove: rt > TRIGGER_PRESS,
    editorUndo: false,
    editorLevelNext: isPressed(gamepad.buttons[0]),
    editorLevelPrev: isPressed(gamepad.buttons[1]),
    editorCycleNext: isPressed(gamepad.buttons[5]),
    editorCyclePrev: isPressed(gamepad.buttons[4]),
    editorCursorUp: isPressed(gamepad.buttons[12]),
    editorCursorDown: isPressed(gamepad.buttons[13]),
    editorCursorLeft: isPressed(gamepad.buttons[14]),
    editorCursorRight: isPressed(gamepad.buttons[15]),
  }
}

/**
 * Gameplay (non-editor) mapping — identical for every connected gamepad slot.
 *
 * @param {Gamepad} gamepad
 * @returns {GameInput}
 */
function getGameplayGamepadInput(gamepad) {
  const horizontal = gamepad.axes[0] ?? 0
  const vertical = gamepad.axes[1] ?? 0
  const lt = gamepad.buttons[6]?.value ?? 0
  const rt = gamepad.buttons[7]?.value ?? 0
  const viewButton = gamepad.buttons[8]
  const menuButton = gamepad.buttons[9]
  return {
    cycleSkin: isPressed(gamepad.buttons[12]),
    shoot: isPressed(gamepad.buttons[3]),
    punchBlock: isPressed(gamepad.buttons[2]),
    editorCycleColor: false,
    down: vertical >= GAMEPAD_AXIS_DEADZONE || isPressed(gamepad.buttons[13]),
    jump: isPressed(gamepad.buttons[0]) || vertical <= -GAMEPAD_AXIS_DEADZONE,
    left:
      horizontal <= -GAMEPAD_AXIS_DEADZONE || isPressed(gamepad.buttons[14]),
    right:
      horizontal >= GAMEPAD_AXIS_DEADZONE || isPressed(gamepad.buttons[15]),
    editorToggle: isPressed(viewButton),
    menuToggle: isPressed(menuButton),
    editorPlace: lt > TRIGGER_PRESS,
    editorRemove: rt > TRIGGER_PRESS,
    editorUndo: false,
    editorLevelNext: isPressed(gamepad.buttons[0]),
    editorLevelPrev: isPressed(gamepad.buttons[1]),
    editorCycleNext: isPressed(gamepad.buttons[5]),
    editorCyclePrev: isPressed(gamepad.buttons[4]),
    editorCursorUp: isPressed(gamepad.buttons[12]),
    editorCursorDown: isPressed(gamepad.buttons[13]),
    editorCursorLeft: isPressed(gamepad.buttons[14]),
    editorCursorRight: isPressed(gamepad.buttons[15]),
  }
}

/**
 * @param {(Gamepad | null)[]} gamepads
 * @param {number} playerIndex
 * @param {boolean} [editorMode]
 * @returns {GameInput}
 */
function getConnectedGamepadInput(gamepads, playerIndex, editorMode = false) {
  const gamepad = getConnectedGamepads(gamepads)[playerIndex]
  if (!gamepad) {
    return EMPTY_INPUT
  }

  if (editorMode) {
    return getEditorGamepadInput(gamepad)
  }

  return getGameplayGamepadInput(gamepad)
}

/**
 * @param {GameInput} primary
 * @param {GameInput} secondary
 * @returns {GameInput}
 */
export function mergeInputs(primary, secondary) {
  return {
    cycleSkin: primary.cycleSkin || secondary.cycleSkin,
    shoot: primary.shoot || secondary.shoot,
    punchBlock: primary.punchBlock || secondary.punchBlock,
    down: primary.down || secondary.down,
    jump: primary.jump || secondary.jump,
    left: primary.left || secondary.left,
    right: primary.right || secondary.right,
    editorToggle: primary.editorToggle || secondary.editorToggle,
    editorPlace: primary.editorPlace || secondary.editorPlace,
    editorRemove: primary.editorRemove || secondary.editorRemove,
    editorUndo: primary.editorUndo || secondary.editorUndo,
    editorLevelNext: primary.editorLevelNext || secondary.editorLevelNext,
    editorLevelPrev: primary.editorLevelPrev || secondary.editorLevelPrev,
    editorCycleNext: primary.editorCycleNext || secondary.editorCycleNext,
    editorCyclePrev: primary.editorCyclePrev || secondary.editorCyclePrev,
    editorCycleColor: primary.editorCycleColor || secondary.editorCycleColor,
    editorCursorUp: primary.editorCursorUp || secondary.editorCursorUp,
    editorCursorDown: primary.editorCursorDown || secondary.editorCursorDown,
    editorCursorLeft: primary.editorCursorLeft || secondary.editorCursorLeft,
    editorCursorRight: primary.editorCursorRight || secondary.editorCursorRight,
    menuToggle: primary.menuToggle || secondary.menuToggle,
  }
}

/**
 * @param {GameKeyboard} keyboard
 * @returns {boolean}
 */
export function hasPlayerTwoKeyboardInput(keyboard) {
  return Boolean(
    keyboard[KEYS.p2.up] ||
    keyboard[KEYS.p2.left] ||
    keyboard[KEYS.p2.down] ||
    keyboard[KEYS.p2.right],
  )
}

/**
 * @param {GamepadButton | undefined} button
 */
function isPressed(button) {
  return Boolean(button?.pressed)
}
