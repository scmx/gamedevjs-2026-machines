/* eslint-disable no-sparse-arrays -- ZzFX presets; holes become undefined like zzfx micro */
/**
 * ZzFX presets (global `zzfx` / `zzfxX` from zzfx.js). No-ops if unavailable.
 *
 * iPad/iPhone Safari often leaves {@link AudioContext} in `suspended` until a user gesture.
 * Playback then fails silently (no buffer played). We `resume()` on interaction and defer
 * `zzfx()` until the context is running when needed.
 */

/** @returns {AudioContext | undefined} */
function getZzfxAudioContext() {
  return /** @type {{ zzfxX?: AudioContext }} */ (globalThis).zzfxX
}

let unlockListenersInstalled = false
let musicNode = undefined
let musicMode = 0
let currentMusicGain = 0.36
const MUSIC_MODE_COUNT = 3
const MUSIC_MODE_LABELS = /** @type {const} */ ({
  melody: "Music: Melody",
  ambient: "Music: Ambient",
  arcade: "Music: Arcade",
})
const MUSIC_MODE_BY_INDEX = /** @type {const} */ (["melody", "ambient", "arcade"])

/** Matches game-controller axis deadzone / trigger threshold. */
const GAMEPAD_AXIS_AUDIO_UNLOCK = 0.25
const GAMEPAD_BUTTON_AUDIO_UNLOCK = 0.45

/**
 * Call once at startup. Unlocks audio on first tap/key, gamepad, and after tab changes (iOS).
 */
export function installZzfxAudioUnlockListeners() {
  if (unlockListenersInstalled) return
  unlockListenersInstalled = true

  const bump = () => {
    void resumeZzfxAudio()
  }
  const startFromUserGesture = () => {
    void resumeZzfxAudio().then(() => startProceduralMusic())
  }
  const opts = { capture: true, passive: true }

  globalThis.addEventListener("pointerdown", startFromUserGesture, opts)
  globalThis.addEventListener("keydown", startFromUserGesture, opts)
  globalThis.addEventListener("touchstart", startFromUserGesture, opts)
  globalThis.addEventListener("gamepadconnected", startFromUserGesture, opts)

  globalThis.addEventListener("focus", bump)
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") bump()
    })
  }
  globalThis.addEventListener(
    "pageshow",
    /** @param {PageTransitionEvent} e */
    (e) => {
      if (e.persisted) bump()
    },
  )
}

/**
 * @param {GameLevel | undefined} level
 * @returns {"melody" | "ambient" | "arcade"}
 */
export function getLevelMusicMode(level) {
  if (!level) return "melody"
  const stored = level.generatedFrom?.music
  if (stored === "melody" || stored === "ambient" || stored === "arcade") return stored
  return defaultMusicModeForLevel(level)
}

/**
 * @param {GameLevel | undefined} level
 * @returns {string}
 */
export function getLevelMusicLabel(level) {
  return MUSIC_MODE_LABELS[getLevelMusicMode(level)] ?? "Music"
}

/**
 * @param {GameLevel} level
 * @returns {"melody" | "ambient" | "arcade"}
 */
export function cycleLevelMusicMode(level) {
  const current = getLevelMusicMode(level)
  const next = MUSIC_MODE_BY_INDEX[(MUSIC_MODE_BY_INDEX.indexOf(current) + 1) % MUSIC_MODE_COUNT] ?? "melody"
  if (level.generatedFrom) level.generatedFrom.music = next
  else level.generatedFrom = { version: 0, seed: 0, music: next }
  musicMode = MUSIC_MODE_BY_INDEX.indexOf(next)
  globalThis.MODEL?.onProjectDirty?.()
  stopProceduralMusic()
  void resumeZzfxAudio().then(() => startProceduralMusic())
  return next
}

/**
 * @param {GameLevel | undefined} level
 */
export function syncMusicModeToLevel(level) {
  musicMode = MUSIC_MODE_BY_INDEX.indexOf(getLevelMusicMode(level))
  if (musicMode < 0) musicMode = 0
}

/**
 * @param {import('./game-state.js').GameModel | undefined} model
 */
export function syncAudioLevelsToModel(model) {
  const music = clampAudioLevel(model?.musicVolume ?? 3)
  const sfx = clampAudioLevel(model?.sfxVolume ?? 3)
  currentMusicGain = [0, 0.12, 0.24, 0.36][music] ?? 0.36
  sfxGain = [0, 0.25, 0.6, 1][sfx] ?? 1
  if (musicNode) {
    const ctx = getZzfxAudioContext()
    if (ctx) {
      const gain = musicNode.__gainNode
      if (gain) gain.gain.value = currentMusicGain
    }
  }
}

/**
 * Resumes the shared ZzFX {@link AudioContext} if suspended (common on mobile Safari).
 *
 * @returns {Promise<void>}
 */
export function resumeZzfxAudio() {
  const ctx = getZzfxAudioContext()
  if (!ctx) return Promise.resolve()
  if (ctx.state === "running") return Promise.resolve()
  return ctx.resume().catch(() => {})
}

/**
 * Gamepads do not emit pointer/key events; the game loop polls so controller-only play still resumes the AudioContext.
 *
 * @param {Gamepad[]} gamepads
 */
export function resumeZzfxAudioIfGamepadActive(gamepads) {
  for (const gp of gamepads) {
    if (!gp.connected) continue
    for (const b of gp.buttons) {
      if (b.pressed || b.value >= GAMEPAD_BUTTON_AUDIO_UNLOCK) {
        void resumeZzfxAudio()
        return
      }
    }
    for (const a of gp.axes) {
      if (Math.abs(a) >= GAMEPAD_AXIS_AUDIO_UNLOCK) {
        void resumeZzfxAudio()
        return
      }
    }
  }
}

let musicStarted = false
let sfxGain = 1

function playTone({
  type = "sine",
  frequency = 440,
  duration = 0.1,
  attack = 0.005,
  decay = 0.08,
  sustain = 0.05,
  release = 0.08,
  gain = 0.2,
  detune = 0,
  slide = 0,
  noise = 0,
  distortion = 0,
} = {}) {
  const ctx = getZzfxAudioContext()
  if (!ctx) return
  if (sfxGain <= 0) return
  if (ctx.state !== "running") {
    void ctx.resume().catch(() => {})
  }
  const now = ctx.currentTime
  const total = attack + decay + sustain + release + duration
  const gainNode = ctx.createGain()
  gainNode.gain.setValueAtTime(0, now)
  const levelGain = gain * sfxGain
  gainNode.gain.linearRampToValueAtTime(levelGain, now + attack)
  gainNode.gain.linearRampToValueAtTime(levelGain * 0.72, now + attack + decay)
  gainNode.gain.setValueAtTime(levelGain * 0.72, now + attack + decay + sustain)
  gainNode.gain.linearRampToValueAtTime(0, now + total)
  gainNode.connect(ctx.destination)

  if (noise > 0) {
    const buffer = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * total)), ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * noise
    }
    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.connect(gainNode)
    src.start(now)
    src.stop(now + total)
    return
  }

  const osc = ctx.createOscillator()
  osc.type = type
  osc.frequency.setValueAtTime(frequency, now)
  if (slide !== 0) {
    osc.frequency.linearRampToValueAtTime(Math.max(40, frequency + slide), now + total)
  }
  if (detune) osc.detune.setValueAtTime(detune, now)
  osc.connect(gainNode)
  if (distortion > 0 && ctx.createWaveShaper) {
    const shaper = ctx.createWaveShaper()
    const samples = 1024
    const curve = new Float32Array(samples)
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1
      curve[i] = Math.tanh(x * distortion)
    }
    shaper.curve = curve
    osc.disconnect()
    osc.connect(shaper)
    shaper.connect(gainNode)
  }
  osc.start(now)
  osc.stop(now + total)
}

export function playSoundExplosion() {
  playTone({ type: "sawtooth", frequency: 64, duration: 0.14, attack: 0.001, decay: 0.05, sustain: 0.02, release: 0.2, gain: 0.25, noise: 0.06, slide: -20, distortion: 2 })
}

export function playSoundJump() {
  playTone({ type: "triangle", frequency: 310, duration: 0.06, attack: 0.003, decay: 0.02, sustain: 0.01, release: 0.05, gain: 0.18, slide: -26 })
}

export function playSoundSpringJump() {
  playTone({ type: "square", frequency: 332, duration: 0.08, attack: 0.001, decay: 0.03, sustain: 0.02, release: 0.08, gain: 0.2, slide: 30, detune: -36 })
}

/** Block coin opens; lock opens */
export function playSoundBlockCoinOrLockOpen() {
  playTone({ type: "triangle", frequency: 613, duration: 0.12, attack: 0.005, decay: 0.04, sustain: 0.04, release: 0.1, gain: 0.12, slide: 419, detune: 735 })
}

export function playSoundLevelComplete() {
  playTone({ type: "sine", frequency: 415, duration: 0.3, attack: 0.01, decay: 0.08, sustain: 0.12, release: 0.2, gain: 0.15, slide: 268, detune: -653 })
}

export function playSoundGemPickup() {
  playTone({ type: "sine", frequency: 676, duration: 0.11, attack: 0.002, decay: 0.03, sustain: 0.02, release: 0.1, gain: 0.18, slide: 491, detune: -1493 })
}

export function playSoundCoinPickup() {
  playTone({ type: "square", frequency: 353, duration: 0.18, attack: 0.002, decay: 0.02, sustain: 0.03, release: 0.08, gain: 0.13, slide: 385, detune: -1 })
}

export function playSoundKeyPickup() {
  playTone({ type: "triangle", frequency: 208, duration: 0.17, attack: 0.003, decay: 0.03, sustain: 0.05, release: 0.08, gain: 0.13, slide: 498, detune: -1469 })
}

export function playSoundPlayerHurt() {
  void resumeZzfxAudio()
  playTone({ type: "sawtooth", frequency: 420, duration: 0.12, attack: 0.001, decay: 0.02, sustain: 0.01, release: 0.1, gain: 0.28, slide: -140, detune: -1490, distortion: 5, noise: 0.04 })
  playTone({ type: "square", frequency: 168, duration: 0.08, attack: 0.001, decay: 0.01, sustain: 0.005, release: 0.07, gain: 0.12, slide: -45, detune: 12 })
}

/** @returns {AudioBuffer | undefined} */
function buildMusicBuffer(mode) {
  const ctx = getZzfxAudioContext()
  if (!ctx) return undefined
  const sr = ctx.sampleRate || 44100
  const seconds = 8
  const buffer = ctx.createBuffer(2, sr * seconds, sr)
  const left = buffer.getChannelData(0)
  const right = buffer.getChannelData(1)
  const modes = [
    {
      step: 0.5,
      notes: [55, 61.74, 65.41, 73.42, 82.41, 98, 82.41, 73.42, 65.41, 61.74, 55, 49],
      bass: [27.5, 27.5, 30.87, 32.7, 36.71, 32.7, 30.87, 27.5, 24.5, 27.5, 30.87, 27.5],
      arp: [110, 123.47, 138.59, 164.81, 184.99, 164.81, 138.59, 123.47],
      leadGain: 0.06,
      bassGain: 0.11,
      padGain: 0.03,
      sparkleGain: 0.02,
      motionRate: 0.45,
      color: 0.85,
    },
    {
      step: 0.66,
      notes: [55, 55, 61.74, 55, 65.41, 55, 61.74, 55, 49, 55, 61.74, 55],
      bass: [27.5, 27.5, 24.5, 27.5, 22.99, 27.5, 24.5, 27.5, 20.6, 24.5, 27.5, 24.5],
      arp: [82.41, 98, 110, 123.47, 138.59, 123.47, 110, 98],
      leadGain: 0.03,
      bassGain: 0.08,
      padGain: 0.08,
      sparkleGain: 0.012,
      motionRate: 0.11,
      color: 0.25,
    },
    {
      step: 0.33,
      notes: [55, 65.41, 73.42, 82.41, 98, 110, 98, 82.41, 73.42, 65.41, 55, 65.41],
      bass: [55, 41.2, 55, 32.7, 41.2, 55, 55, 41.2, 55, 32.7, 41.2, 55],
      arp: [164.81, 196, 220, 246.94, 261.63, 246.94, 220, 196],
      leadGain: 0.08,
      bassGain: 0.1,
      padGain: 0.015,
      sparkleGain: 0.028,
      motionRate: 1.4,
      color: 0.55,
    },
  ]
  const m = modes[mode] ?? modes[0]
  const modeStep = m.step

  for (let i = 0; i < left.length; i++) {
    const t = i / sr
    const barPhase = (t / modeStep) % m.notes.length
    const step = Math.floor(barPhase)
    const note = m.notes[step] ?? 55
    const bass = m.bass[step] ?? 27.5
    const arp = m.arp[step % m.arp.length] ?? note
    const beat = (t % modeStep) / modeStep
    const env = smoothEnvelope(beat, 0.08, 0.22)
    const lfo = Math.sin(t * 2 * Math.PI * m.motionRate) * (m.color * 0.04)
    const lead =
      shapedVoice(t, note + lfo, "triangle", 0.6) * m.leadGain +
      shapedVoice(t, arp * 2 + lfo, "sine", 0.35) * m.sparkleGain
    const low = shapedVoice(t, bass, "sine", 0.7) * m.bassGain
    const pad = shapedVoice(t, arp / 2, "triangle", 0.45) * m.padGain
    const pulse = softPulse(t, mode === 2 ? 7 : 3, m.sparkleGain * 0.55)
    const sample = clampSample((lead + low + pad + pulse) * env)
    left[i] = sample
    right[i] = sample
  }

  return buffer
}

function smoothEnvelope(beat, attack, release) {
  const a = Math.min(1, Math.max(0, beat / attack))
  const r = Math.min(1, Math.max(0, (1 - beat) / release))
  return easeInOut(a * r)
}

function softPulse(t, rate, gain) {
  const phase = (t * rate) % 1
  const body = Math.sin(t * 2 * Math.PI * rate) * 0.35
  const click = Math.sin(t * 2 * Math.PI * rate * 2) * 0.08
  return (body + click) * gain * smoothEnvelope(phase, 0.14, 0.24)
}

function shapedVoice(t, frequency, type, warmth = 0.5) {
  const phase = t * 2 * Math.PI * frequency
  const s = Math.sin(phase)
  if (type === "sine") return s
  if (type === "triangle") return Math.asin(Math.sin(phase)) * (2 / Math.PI)
  const saw = 1 - (2 * ((phase / (2 * Math.PI)) % 1))
  return saw * warmth + s * (1 - warmth)
}

function easeInOut(v) {
  return v * v * (3 - 2 * v)
}

function clampSample(v) {
  return Math.max(-0.85, Math.min(0.85, v))
}

/**
 * Start a procedural loop using plain Web Audio so the game doesn't depend on the
 * ZzFXM playback path at runtime.
 */
export function startProceduralMusic() {
  if (musicStarted) return
  const ctx = getZzfxAudioContext()
  if (!ctx || ctx.state !== "running") return
  syncMusicModeToLevel(/** @type {GameLevel | undefined} */ (globalThis.MODEL?.levels?.[0]))
  const buffer = buildMusicBuffer(musicMode)
  if (!buffer) return
  stopProceduralMusic()
  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.loop = true
  const gain = ctx.createGain()
  gain.gain.value = currentMusicGain
  source.connect(gain)
  gain.connect(ctx.destination)
  source.start()
  musicNode = source
  musicNode.__gainNode = gain
  musicStarted = true
}

function stopProceduralMusic() {
  if (!musicNode) return
  try {
    musicNode.stop()
  } catch {
    /* ignore */
  }
  musicNode = undefined
  musicStarted = false
}

/**
 * @param {number} value
 * @returns {0 | 1 | 2 | 3}
 */
function clampAudioLevel(value) {
  return /** @type {0 | 1 | 2 | 3} */ (Math.max(0, Math.min(3, value | 0)))
}

/**
 * @param {GameLevel} level
 * @returns {"melody" | "ambient" | "arcade"}
 */
function defaultMusicModeForLevel(level) {
  const terrain = level.layers.terrainVariant?.[0] ?? ""
  const ch = terrain.trim()[0] ?? "g"
  switch (ch) {
    case "w":
      return "ambient"
    case "s":
      return "ambient"
    case "t":
      return "arcade"
    case "d":
      return "melody"
    case "p":
      return "arcade"
    default:
      return "melody"
  }
}
