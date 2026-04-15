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
  editorToggle: boolean
  editorPlace: boolean
  editorRemove: boolean
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
}

type GameLevel = {
  id: string
  name: string
  width: number
  height: number
  layers: {
    terrain: string[]
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
  onLadder: boolean
  hearts: number
  maxHearts: number
  gems: number
  keys: Record<string, boolean>
}

interface Window {
  MODEL?: import("./game-state.js").GameModel
}
