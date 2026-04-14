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
}

type GameWorld = {
  width: number
  height: number
  background: string
  ground: string
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
}

interface Window {
  MODEL?: import("./game-state.js").GameModel
}
