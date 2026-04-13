/** @type {(keyof GameInput)[]} */
const ACTIONS = ["jump", "left", "down", "right"]
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
  /** @type {GameInput[]} */
  const inputs = [getKeyboardInput(keyboard)]

  for (const gamepad of gamepads) {
    if (!gamepad?.connected) continue
    inputs[gamepad.index] = getGamepadInput(gamepad)
  }

  return inputs
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
  if (ACTIONS[index % ACTIONS.length] === "jump" && event.repeat) return
  keyboard[index] = pressed
}

/**
 * @param {GameKeyboard} keyboard
 * @returns {GameInput}
 */
function getKeyboardInput(keyboard) {
  /** @type {GameInput} */
  const input = {
    down: false,
    jump: false,
    left: false,
    right: false,
  }

  for (let i = 0; i < keyboard.length; i++) {
    if (!keyboard[i]) continue
    const action = ACTIONS[i % ACTIONS.length]
    if (!action) continue
    input[action] = true
  }

  return input
}

/**
 * @param {Gamepad} gamepad
 * @returns {GameInput}
 */
function getGamepadInput(gamepad) {
  const horizontal = gamepad.axes[0] ?? 0
  const vertical = gamepad.axes[1] ?? 0

  return {
    down: vertical >= GAMEPAD_AXIS_DEADZONE || isPressed(gamepad.buttons[13]),
    jump: isPressed(gamepad.buttons[0]),
    left:
      horizontal <= -GAMEPAD_AXIS_DEADZONE || isPressed(gamepad.buttons[14]),
    right:
      horizontal >= GAMEPAD_AXIS_DEADZONE || isPressed(gamepad.buttons[15]),
  }
}

/**
 * @param {GamepadButton | undefined} button
 */
function isPressed(button) {
  return Boolean(button?.pressed)
}
