export type ElementType = 'text' | 'rect' | 'ellipse' | 'polygon' | 'star' | 'line' | 'arrow' | 'path' | 'image'

export interface GradientStop { offset: number; color: string }

export type Fill =
  | { type: 'none' }
  | { type: 'solid'; color: string }
  | { type: 'linear'; angle: number; stops: GradientStop[] }
  | { type: 'radial'; stops: GradientStop[] }
  | { type: 'pattern'; pattern: string; src?: string; scale: number; colors?: [string, string] }

export interface Stroke { enabled: boolean; color: string; width: number; dash?: number }
export interface Shadow { enabled: boolean; color: string; blur: number; offsetX: number; offsetY: number }
export interface Glow { enabled: boolean; color: string; blur: number; strength: number }
export interface Extrude { enabled: boolean; color: string; depth: number; angle: number }

export type BlendMode =
  | 'source-over' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten' | 'color-dodge'
  | 'color-burn' | 'hard-light' | 'soft-light' | 'difference' | 'exclusion' | 'hue'
  | 'saturation' | 'color' | 'luminosity'

export type AnimProp = 'x' | 'y' | 'rotation' | 'scale' | 'opacity'

export interface Keyframe { t: number; value: number; easing: string }

export interface PresetClip {
  preset: string
  duration: number
  delay: number
  easing: string
  /** emphasis only */
  loop?: boolean
}

export interface ElementAnimation {
  /** visibility window on the timeline (seconds) */
  start: number
  end: number
  enter?: PresetClip
  exit?: PresetClip
  emphasis?: PresetClip
  keyframes: Partial<Record<AnimProp, Keyframe[]>>
}

export interface ImageFilters {
  brightness: number; contrast: number; saturate: number; blur: number
  grayscale: number; sepia: number; hueRotate: number; invert: number
}

export interface BaseElement {
  id: string
  type: ElementType
  name: string
  /** center position in artboard px */
  x: number
  y: number
  width: number
  height: number
  rotation: number
  opacity: number
  blendMode: BlendMode
  visible: boolean
  locked: boolean
  groupId?: string
  fill: Fill
  stroke: Stroke
  shadow: Shadow
  glow: Glow
  anim: ElementAnimation
}

export type TextWarp = 'none' | 'arc' | 'wave' | 'circle'

export interface TextElement extends BaseElement {
  type: 'text'
  text: string
  fontFamily: string
  fontSize: number
  fontWeight: number
  italic: boolean
  letterSpacing: number
  lineHeight: number
  align: 'left' | 'center' | 'right'
  transform: 'none' | 'uppercase' | 'lowercase'
  extrude: Extrude
  /** second, outer outline */
  outline2: Stroke
  warp: TextWarp
  /** arc: degrees of bend (-360..360); wave: amplitude */
  warpAmount: number
  rgbSplit: number
}

export interface ShapeElement extends BaseElement {
  type: 'rect' | 'ellipse' | 'polygon' | 'star' | 'line' | 'arrow'
  radius?: number
  sides?: number
  innerRatio?: number
}

export interface PathPoint { x: number; y: number; p?: number }

export interface PathElement extends BaseElement {
  type: 'path'
  /** points in local coords relative to box top-left at size (baseW, baseH) */
  points: PathPoint[]
  baseW: number
  baseH: number
  closed: boolean
  smooth: boolean
  brush: 'pen' | 'pencil' | 'brush' | 'marker' | 'highlighter' | 'eraser'
}

export interface ImageElement extends BaseElement {
  type: 'image'
  src: string
  filters: ImageFilters
  radius: number
}

export type DesignElement = TextElement | ShapeElement | PathElement | ImageElement

export interface Artboard { width: number; height: number; background: Fill }

export interface Project {
  id: string
  name: string
  version: 1
  artboard: Artboard
  duration: number
  elements: DesignElement[]
  updatedAt: number
}

/** runtime transform produced by animation evaluation */
export interface AnimState {
  dx: number
  dy: number
  scaleX: number
  scaleY: number
  rotation: number
  opacity: number
  skewX: number
  blur: number
  hue: number
  /** reveal clip 0..1 (1=full) */
  reveal: number
  revealDir: 'left' | 'right' | 'up' | 'down' | 'center'
  /** text: fraction of visible chars 0..1 (Infinity = all) */
  chars: number
  /** per-char transform */
  perChar?: (i: number, n: number) => CharState
  rgbSplit: number
}

export interface CharState { dx: number; dy: number; scale: number; rotation: number; opacity: number }
