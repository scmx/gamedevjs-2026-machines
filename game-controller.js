const GAMEPAD_AXIS_DEADZONE = 0.25
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
]
const PLAYER_TWO_KEY_OFFSET = 5
const EMPTY_INPUT = Object.freeze({
  cycleSkin: false,
  down: false,
  jump: false,
  left: false,
  right: false,
})

/** @returns {GameKeyboard} */
export function createKeyboard() {
  return Array(KEYS.length).fill(false)
}

/**
 * @param {GameKeyboard} keyboard
 * @param {(Gamepad | null)[]} [gamepads]
 * @returns {GameInput[]}
 */
export function getInputs(keyboard, gamepads = navigator.getGamepads()) {
  return [
    mergeInputs(
      getPlayerOneKeyboardInput(keyboard),
      getConnectedGamepadInput(gamepads, 0),
    ),
    mergeInputs(
      getPlayerTwoKeyboardInput(keyboard),
      getConnectedGamepadInput(gamepads, 1),
    ),
  ]
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
 * @returns {GameInput}
 */
function getPlayerOneKeyboardInput(keyboard) {
  return {
    cycleSkin: false,
    jump: Boolean(keyboard[0] || keyboard[4]),
    left: Boolean(keyboard[1]),
    down: Boolean(keyboard[2]),
    right: Boolean(keyboard[3]),
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

  return {
    cycleSkin: isPressed(gamepad.buttons[2]) || isPressed(gamepad.buttons[3]),
    down: vertical >= GAMEPAD_AXIS_DEADZONE || isPressed(gamepad.buttons[13]),
    jump: isPressed(gamepad.buttons[0]),
    left:
      horizontal <= -GAMEPAD_AXIS_DEADZONE || isPressed(gamepad.buttons[14]),
    right:
      horizontal >= GAMEPAD_AXIS_DEADZONE || isPressed(gamepad.buttons[15]),
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
