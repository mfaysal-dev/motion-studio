import type { DesignElement, ElementAnimation, Fill, ImageElement, PathElement, Project, ShapeElement, TextElement, ElementType, Stroke } from './types'

let counter = 0
export function uid(prefix = 'el'): string {
  counter = (counter + 1) % 1e6
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}${counter.toString(36)}`
}

export const solid = (color: string): Fill => ({ type: 'solid', color })
export const linear = (angle: number, ...colors: string[]): Fill => ({
  type: 'linear', angle, stops: colors.map((c, i) => ({ offset: colors.length === 1 ? 0 : i / (colors.length - 1), color: c })),
})
export const radial = (...colors: string[]): Fill => ({
  type: 'radial', stops: colors.map((c, i) => ({ offset: colors.length === 1 ? 0 : i / (colors.length - 1), color: c })),
})
const noStroke = (): Stroke => ({ enabled: false, color: '#000000', width: 4 })

export function defaultAnim(duration = 6): ElementAnimation {
  return { start: 0, end: duration, keyframes: {} }
}

function base(type: ElementType, name: string, duration: number) {
  return {
    id: uid(), type, name, x: 0, y: 0, width: 200, height: 200, rotation: 0, opacity: 1,
    blendMode: 'source-over' as const, visible: true, locked: false,
    fill: solid('#7c5cff'), stroke: noStroke(),
    shadow: { enabled: false, color: 'rgba(0,0,0,0.45)', blur: 20, offsetX: 0, offsetY: 10 },
    glow: { enabled: false, color: '#7c5cff', blur: 24, strength: 2 },
    anim: defaultAnim(duration),
  }
}

export function createText(p: Partial<TextElement> = {}, duration = 6): TextElement {
  return {
    ...base('text', 'Text', duration),
    fill: solid('#ffffff'),
    text: 'Your Text', fontFamily: 'Inter', fontSize: 96, fontWeight: 800, italic: false,
    letterSpacing: 0, lineHeight: 1.1, align: 'center', transform: 'none',
    extrude: { enabled: false, color: '#2a1b6b', depth: 12, angle: 45 },
    outline2: { enabled: false, color: '#000000', width: 6 },
    warp: 'none', warpAmount: 120, rgbSplit: 0,
    ...p,
    type: 'text',
  } as TextElement
}

export function createShape(type: ShapeElement['type'], p: Partial<ShapeElement> = {}, duration = 6): ShapeElement {
  const names: Record<string, string> = { rect: 'Rectangle', ellipse: 'Ellipse', polygon: 'Polygon', star: 'Star', line: 'Line', arrow: 'Arrow' }
  const isLine = type === 'line' || type === 'arrow'
  return {
    ...base(type, names[type], duration),
    ...(isLine ? { height: 40, fill: { type: 'none' } as Fill, stroke: { enabled: true, color: '#ffffff', width: 8 } } : {}),
    radius: type === 'rect' ? 24 : undefined,
    sides: type === 'polygon' ? 6 : type === 'star' ? 5 : undefined,
    innerRatio: type === 'star' ? 0.45 : undefined,
    ...p,
    type,
  } as ShapeElement
}

export function createPath(p: Partial<PathElement>, duration = 6): PathElement {
  return {
    ...base('path', p.brush === 'eraser' ? 'Eraser' : 'Drawing', duration),
    fill: { type: 'none' }, stroke: { enabled: true, color: '#ffffff', width: 8 },
    points: [], baseW: 1, baseH: 1, closed: false, smooth: true, brush: 'brush',
    ...p,
    type: 'path',
  } as PathElement
}

export function createImage(src: string, w: number, h: number, p: Partial<ImageElement> = {}, duration = 6): ImageElement {
  return {
    ...base('image', 'Image', duration),
    fill: { type: 'none' }, width: w, height: h, src, radius: 0,
    filters: { brightness: 100, contrast: 100, saturate: 100, blur: 0, grayscale: 0, sepia: 0, hueRotate: 0, invert: 0 },
    ...p,
    type: 'image',
  } as ImageElement
}

export function emptyProject(width = 1080, height = 1080, name = 'Untitled design'): Project {
  return { id: uid('prj'), name, version: 1, artboard: { width, height, background: solid('#0f0f17') }, duration: 6, elements: [], updatedAt: Date.now() }
}

/** Fill in missing fields for imported / older projects. */
export function normalizeProject(raw: unknown): Project {
  const r = raw as Partial<Project>
  if (!r || typeof r !== 'object' || !r.artboard || !Array.isArray(r.elements)) throw new Error('Not a Kinetica project file')
  const duration = typeof r.duration === 'number' && r.duration > 0 ? r.duration : 6
  const elements = (r.elements as DesignElement[]).map((e) => {
    const d =
      e.type === 'text' ? createText({}, duration)
      : e.type === 'path' ? createPath({}, duration)
      : e.type === 'image' ? createImage((e as ImageElement).src ?? '', 100, 100, {}, duration)
      : createShape(e.type as ShapeElement['type'], {}, duration)
    const merged = { ...d, ...e } as DesignElement
    merged.anim = { ...defaultAnim(duration), ...(e.anim ?? {}), keyframes: { ...(e.anim?.keyframes ?? {}) } }
    merged.id = typeof e.id === 'string' ? e.id : uid()
    return merged
  })
  return {
    id: typeof r.id === 'string' ? r.id : uid('prj'),
    name: typeof r.name === 'string' ? r.name : 'Imported design',
    version: 1,
    artboard: { width: Number(r.artboard.width) || 1080, height: Number(r.artboard.height) || 1080, background: r.artboard.background ?? solid('#111') },
    duration,
    elements,
    updatedAt: Date.now(),
  }
}

export const ARTBOARD_PRESETS = [
  { id: 'ig-post', name: 'Instagram Post', w: 1080, h: 1080 },
  { id: 'ig-portrait', name: 'Instagram Portrait', w: 1080, h: 1350 },
  { id: 'ig-story', name: 'Story / Reel', w: 1080, h: 1920 },
  { id: 'yt-thumb', name: 'YouTube Thumbnail', w: 1280, h: 720 },
  { id: 'hd', name: 'Video 1080p', w: 1920, h: 1080 },
  { id: 'fb-cover', name: 'Facebook Cover', w: 1640, h: 624 },
  { id: 'x-post', name: 'X / Twitter Post', w: 1600, h: 900 },
  { id: 'a4', name: 'A4 Portrait', w: 2480, h: 3508 },
  { id: 'a4l', name: 'A4 Landscape', w: 3508, h: 2480 },
  { id: 'logo', name: 'Logo 512', w: 512, h: 512 },
]
