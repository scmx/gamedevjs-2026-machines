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
}

type GameWorld = {
  width: number
  height: number
  background: string
  ground: string
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
}

interface Window {
  MODEL?: import("./game-state.js").GameModel
}
