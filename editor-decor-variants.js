/** Variants for combined editor tools (cycle with Q / X). */

export const EDITOR_BRIDGE_VARIANTS = Object.freeze([
  { kind: "bridge", sprite: "bridge", solid: true, label: "plank" },
  { kind: "bridge_logs", sprite: "bridge_logs", solid: true, label: "logs" },
])

export const EDITOR_ROPE_VARIANTS = Object.freeze([
  { kind: "rope", sprite: "rope", solid: false, label: "rope" },
  { kind: "chain", sprite: "chain", solid: false, label: "chain" },
])

export const EDITOR_ROCK_VARIANTS = Object.freeze([
  { kind: "rock", sprite: "rock", solid: true, label: "rock" },
  { kind: "weight", sprite: "weight", solid: false, label: "weight" },
])
