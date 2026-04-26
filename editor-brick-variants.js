/** Brick tool: solid bricks, or decorative walk-through hill (object layer). */
export const EDITOR_BRICK_VARIANTS = Object.freeze([
  { kind: "block_bricks_brown", sprite: "bricks_brown", label: "Brown" },
  { kind: "block_bricks_grey", sprite: "bricks_grey", label: "Grey" },
  {
    kind: "hill",
    sprite: "hill_top_smile",
    solid: false,
    label: "Hill",
  },
])
