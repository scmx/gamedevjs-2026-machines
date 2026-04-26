type GameVectorLike = {
  x: number
  y: number
}

type GameKeyboard = boolean[]

type GameInput = {
  down: boolean
  jump: boolean
  left: boolean
  right: boolean
  cycleSkin: boolean
  shoot: boolean
  punchBlock: boolean
  menuToggle: boolean
  editorToggle: boolean
  editorPlace: boolean
  editorRemove: boolean
  editorUndo: boolean
  editorLevelNext: boolean
  editorLevelPrev: boolean
  editorCycleNext: boolean
  editorCyclePrev: boolean
  editorCycleColor: boolean
  editorCursorUp: boolean
  editorCursorDown: boolean
  editorCursorLeft: boolean
  editorCursorRight: boolean
}

type GameWorld = {
  width: number
  height: number
  background: string
  ground: string
}

type GameCamera = {
  x: number
  y: number
  viewportWidth: number
  viewportHeight: number
}

type GameLevelGeneratedFrom = {
  version: number
  seed: number
  music?: "melody" | "ambient" | "arcade"
}

type GameLevelObject = {
  kind: string
  x: number
  y: number
  width: number
  height: number
  solid?: boolean
  sprite?: string
  collected?: boolean
  vx?: number
  vy?: number
  state?: string
  timer?: number
  pressed?: boolean
  activated?: boolean
  _prevStepped?: boolean
  upsideDown?: boolean
  /** saw: center tile coords */
  anchorX?: number
  anchorY?: number
  fishX?: number
  fishY?: number
  fishVx?: number
  fishLife?: number
}

type GameLevel = {
  id: string
  name: string
  width: number
  height: number
  layers: {
    terrain: string[]
    /** Same width/height as terrain; one char per tile biome id (space = air). */
    terrainVariant?: string[]
  }
  objects: GameLevelObject[]
  generatedFrom: GameLevelGeneratedFrom
}

type GameActorData = {
  index: number
  oldPos: GameVectorLike
  pos: GameVectorLike
  velocity: GameVectorLike
  size: GameVectorLike
  speed: number
  color: string
  skin: string
  grounded: boolean
  cycleSkinPressed: boolean
  shootPressed: boolean
  punchBlockPressed: boolean
  onLadder: boolean
  inWater: boolean
  /** Full hearts (integer). */
  hearts: number
  maxHearts: number
  /** Half-heart units (0 = dead, 2 * maxHearts = full). */
  heartHalves: number
  maxHeartHalves: number
  hurtCooldown: number
  gems: number
  coins: number
  keys: Record<string, boolean>
}

interface Window {
  MODEL?: import("./game-state.js").GameModel
}
