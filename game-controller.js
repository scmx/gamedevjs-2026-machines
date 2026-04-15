const GAMEPAD_AXIS_DEADZONE = 0.25
const TRIGGER_PRESS = 0.45
const KEYS = [
  "ArrowUp",
  "ArrowLeft",
  "ArrowDown",
  "ArrowRight",
  "Space",
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "KeyE",
  "BracketLeft",
  "BracketRight",
  "KeyF",
  "KeyV",
  "KeyC",
]
const PLAYER_TWO_KEY_OFFSET = 5
const KEY_C = 14

/** @type {GameInput} */
const EMPTY_INPUT = Object.freeze({
  cycleSkin: false,
  down: false,
  jump: false,
  left: false,
  right: false,
  editorToggle: false,
  editorPlace: false,
  editorRemove: false,
  editorCycleNext: false,
  editorCyclePrev: false,
  editorCursorUp: false,
  editorCursorDown: false,
  editorCursorLeft: false,
  editorCursorRight: false,
})

/** @returns {GameKeyboard} */
export function createKeyboard() {
  return Array(KEYS.length).fill(false)
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
  const p1 = mergeInputs(
    getPlayerOneKeyboardInput(keyboard, editorMode),
    getConnectedGamepadInput(gamepads, 0),
  )
  if (editorMode) {
    p1.cycleSkin = false
    p1.jump = false
    p1.left = false
    p1.right = false
    p1.down = false
  }

  const p2 = mergeInputs(
    getPlayerTwoKeyboardInput(keyboard),
    getConnectedGamepadInput(gamepads, 1),
  )
  if (editorMode) {
    p2.cycleSkin = false
    p2.jump = false
    p2.left = false
    p2.right = false
    p2.down = false
  }

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
 * @param {KeyboardEvent} event
 * @param {GameKeyboard} keyboard
 * @param {boolean} pressed
 */
export function setInputState(event, keyboard, pressed) {
  const index = KEYS.indexOf(event.code)
  if (index === -1) return
  event.preventDefault()
  keyboard[index] = pressed
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
      down: false,
      jump: false,
      left: false,
      right: false,
      editorToggle: Boolean(keyboard[9]),
      editorPlace: Boolean(keyboard[12]),
      editorRemove: Boolean(keyboard[13]),
      editorCycleNext: Boolean(keyboard[11]),
      editorCyclePrev: Boolean(keyboard[10]),
      editorCursorUp: Boolean(keyboard[0]),
      editorCursorDown: Boolean(keyboard[2]),
      editorCursorLeft: Boolean(keyboard[1]),
      editorCursorRight: Boolean(keyboard[3]),
    }
  }

  return {
    cycleSkin: Boolean(keyboard[KEY_C]),
    down: Boolean(keyboard[2]),
    jump: Boolean(keyboard[0] || keyboard[4]),
    left: Boolean(keyboard[1]),
    right: Boolean(keyboard[3]),
    editorToggle: Boolean(keyboard[9]),
    editorPlace: false,
    editorRemove: false,
    editorCycleNext: false,
    editorCyclePrev: false,
    editorCursorUp: false,
    editorCursorDown: false,
    editorCursorLeft: false,
    editorCursorRight: false,
  }
}

/**
 * @param {GameKeyboard} keyboard
 * @returns {GameInput}
 */
function getPlayerTwoKeyboardInput(keyboard) {
  return {
    cycleSkin: false,
    jump: Boolean(keyboard[PLAYER_TWO_KEY_OFFSET]),
    left: Boolean(keyboard[PLAYER_TWO_KEY_OFFSET + 1]),
    down: Boolean(keyboard[PLAYER_TWO_KEY_OFFSET + 2]),
    right: Boolean(keyboard[PLAYER_TWO_KEY_OFFSET + 3]),
    editorToggle: false,
    editorPlace: false,
    editorRemove: false,
    editorCycleNext: false,
    editorCyclePrev: false,
    editorCursorUp: false,
    editorCursorDown: false,
    editorCursorLeft: false,
    editorCursorRight: false,
  }
}

/**
 * @param {(Gamepad | null)[]} gamepads
 * @param {number} playerIndex
 * @returns {GameInput}
 */
function getConnectedGamepadInput(gamepads, playerIndex) {
  const gamepad = getConnectedGamepads(gamepads)[playerIndex]
  if (!gamepad) {
    return EMPTY_INPUT
  }

  const horizontal = gamepad.axes[0] ?? 0
  const vertical = gamepad.axes[1] ?? 0

  const lt = gamepad.buttons[6]?.value ?? 0
  const rt = gamepad.buttons[7]?.value ?? 0

  if (playerIndex === 0) {
    return {
      cycleSkin: isPressed(gamepad.buttons[2]),
      down: vertical >= GAMEPAD_AXIS_DEADZONE || isPressed(gamepad.buttons[13]),
      jump: isPressed(gamepad.buttons[0]),
      left:
        horizontal <= -GAMEPAD_AXIS_DEADZONE || isPressed(gamepad.buttons[14]),
      right:
        horizontal >= GAMEPAD_AXIS_DEADZONE || isPressed(gamepad.buttons[15]),
      editorToggle: isPressed(gamepad.buttons[3]),
      editorPlace: lt > TRIGGER_PRESS,
      editorRemove: rt > TRIGGER_PRESS,
      editorCycleNext: isPressed(gamepad.buttons[5]),
      editorCyclePrev: isPressed(gamepad.buttons[4]),
      editorCursorUp: isPressed(gamepad.buttons[12]),
      editorCursorDown: isPressed(gamepad.buttons[13]),
      editorCursorLeft: isPressed(gamepad.buttons[14]),
      editorCursorRight: isPressed(gamepad.buttons[15]),
    }
  }

  return {
    cycleSkin: false,
    jump: isPressed(gamepad.buttons[0]),
    left:
      horizontal <= -GAMEPAD_AXIS_DEADZONE || isPressed(gamepad.buttons[14]),
    down: vertical >= GAMEPAD_AXIS_DEADZONE || isPressed(gamepad.buttons[13]),
    right:
      horizontal >= GAMEPAD_AXIS_DEADZONE || isPressed(gamepad.buttons[15]),
    editorToggle: false,
    editorPlace: false,
    editorRemove: false,
    editorCycleNext: false,
    editorCyclePrev: false,
    editorCursorUp: false,
    editorCursorDown: false,
    editorCursorLeft: false,
    editorCursorRight: false,
  }
}

/**
 * @param {GameInput} primary
 * @param {GameInput} secondary
 * @returns {GameInput}
 */
function mergeInputs(primary, secondary) {
  return {
    cycleSkin: primary.cycleSkin || secondary.cycleSkin,
    down: primary.down || secondary.down,
    jump: primary.jump || secondary.jump,
    left: primary.left || secondary.left,
    right: primary.right || secondary.right,
    editorToggle: primary.editorToggle || secondary.editorToggle,
    editorPlace: primary.editorPlace || secondary.editorPlace,
    editorRemove: primary.editorRemove || secondary.editorRemove,
    editorCycleNext: primary.editorCycleNext || secondary.editorCycleNext,
    editorCyclePrev: primary.editorCyclePrev || secondary.editorCyclePrev,
    editorCursorUp: primary.editorCursorUp || secondary.editorCursorUp,
    editorCursorDown: primary.editorCursorDown || secondary.editorCursorDown,
    editorCursorLeft: primary.editorCursorLeft || secondary.editorCursorLeft,
    editorCursorRight: primary.editorCursorRight || secondary.editorCursorRight,
  }
}

/**
 * @param {GameKeyboard} keyboard
 * @returns {boolean}
 */
export function hasPlayerTwoKeyboardInput(keyboard) {
  return Boolean(
    keyboard[PLAYER_TWO_KEY_OFFSET] ||
    keyboard[PLAYER_TWO_KEY_OFFSET + 1] ||
    keyboard[PLAYER_TWO_KEY_OFFSET + 2] ||
    keyboard[PLAYER_TWO_KEY_OFFSET + 3],
  )
}

/**
 * @param {GamepadButton | undefined} button
 */
function isPressed(button) {
  return Boolean(button?.pressed)
}
