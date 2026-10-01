import type { AnimState, CharState, DesignElement, PresetClip, AnimProp } from './types'
import { ease, getEasing } from './easing'
import { interpolate } from './keyframes'

export type PresetKind = 'enter' | 'exit' | 'emphasis'

export interface PresetCtx { w: number; h: number; fs: number; time: number; dist: number; ease: (t: number) => number }

interface PresetDef {
  id: string
  name: string
  outName?: string
  kind: 'enter' | 'emphasis'
  textOnly?: boolean
  duration: number
  easing: string
  /** enter: p 0→1 (eased unless perChar); emphasis: q phase 0→1 */
  apply: (s: AnimState, p: number, c: PresetCtx) => void
  /** use raw linear p (per-char presets apply their own easing per letter) */
  raw?: boolean
  category: string
}

export function identityState(): AnimState {
  return { dx: 0, dy: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1, skewX: 0, blur: 0, hue: 0, reveal: 1, revealDir: 'left', chars: Infinity, rgbSplit: 0 }
}

/** deterministic 0..1 hash */
export function hash01(n: number, seed = 0): number {
  const x = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453
  return x - Math.floor(x)
}

const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t)
/** staggered local progress for letter i of n */
export function stagger(p: number, i: number, n: number, k = 3): number {
  return clamp01((p * (n - 1 + k) - i) / k)
}
const perChar = (s: AnimState, fn: (i: number, n: number) => CharState) => {
  s.perChar = fn
}
const ID_CHAR: CharState = { dx: 0, dy: 0, scale: 1, rotation: 0, opacity: 1 }

const DEFS: PresetDef[] = [
  // ——— entrances ———
  { id: 'fadeIn', name: 'Fade In', outName: 'Fade Out', kind: 'enter', duration: 0.6, easing: 'easeOutCubic', category: 'Basic', apply: (s, p) => { s.opacity = p } },
  { id: 'slideLeft', name: 'Slide In Left', outName: 'Slide Out Left', kind: 'enter', duration: 0.7, easing: 'easeOutCubic', category: 'Slide', apply: (s, p, c) => { s.dx = -(1 - p) * c.dist; s.opacity = clamp01(p * 2) } },
  { id: 'slideRight', name: 'Slide In Right', outName: 'Slide Out Right', kind: 'enter', duration: 0.7, easing: 'easeOutCubic', category: 'Slide', apply: (s, p, c) => { s.dx = (1 - p) * c.dist; s.opacity = clamp01(p * 2) } },
  { id: 'slideUp', name: 'Slide In Up', outName: 'Slide Out Down', kind: 'enter', duration: 0.7, easing: 'easeOutCubic', category: 'Slide', apply: (s, p, c) => { s.dy = (1 - p) * c.dist; s.opacity = clamp01(p * 2) } },
  { id: 'slideDown', name: 'Slide In Down', outName: 'Slide Out Up', kind: 'enter', duration: 0.7, easing: 'easeOutCubic', category: 'Slide', apply: (s, p, c) => { s.dy = -(1 - p) * c.dist; s.opacity = clamp01(p * 2) } },
  { id: 'riseUp', name: 'Rise', outName: 'Sink', kind: 'enter', duration: 0.8, easing: 'easeOutQuart', category: 'Basic', apply: (s, p) => { s.dy = (1 - p) * 40; s.opacity = p } },
  { id: 'zoomIn', name: 'Zoom In', outName: 'Zoom Out', kind: 'enter', duration: 0.6, easing: 'easeOutCubic', category: 'Zoom', apply: (s, p) => { const k = 0.3 + 0.7 * p; s.scaleX = k; s.scaleY = k; s.opacity = p } },
  { id: 'shrinkIn', name: 'Shrink In', outName: 'Grow Out', kind: 'enter', duration: 0.6, easing: 'easeOutCubic', category: 'Zoom', apply: (s, p) => { const k = 1 + (1 - p) * 1.5; s.scaleX = k; s.scaleY = k; s.opacity = p } },
  { id: 'popIn', name: 'Pop', outName: 'Pop Out', kind: 'enter', duration: 0.5, easing: 'easeOutBack', category: 'Zoom', apply: (s, p) => { s.scaleX = p; s.scaleY = p; s.opacity = clamp01(p * 3) } },
  { id: 'elasticIn', name: 'Elastic', outName: 'Elastic Out', kind: 'enter', duration: 1.1, easing: 'easeOutElastic', category: 'Zoom', apply: (s, p) => { s.scaleX = p; s.scaleY = p; s.opacity = clamp01(p * 4) } },
  { id: 'bounceIn', name: 'Bounce In', outName: 'Bounce Out', kind: 'enter', duration: 1, easing: 'easeOutBounce', category: 'Bounce', apply: (s, p, c) => { s.dy = -(1 - p) * c.dist; s.opacity = clamp01(p * 4) } },
  { id: 'dropIn', name: 'Drop In', outName: 'Lift Out', kind: 'enter', duration: 0.8, easing: 'easeOutBack', category: 'Bounce', apply: (s, p, c) => { s.dy = -(1 - p) * c.dist * 1.4; s.scaleY = 1 + (1 - p) * 0.3; s.scaleX = 1 - (1 - p) * 0.15; s.opacity = clamp01(p * 3) } },
  { id: 'rotateIn', name: 'Rotate In', outName: 'Rotate Out', kind: 'enter', duration: 0.7, easing: 'easeOutCubic', category: 'Rotate', apply: (s, p) => { s.rotation = -(1 - p) * 180; const k = 0.5 + 0.5 * p; s.scaleX = k; s.scaleY = k; s.opacity = p } },
  { id: 'spinIn', name: 'Spin In', outName: 'Spin Out', kind: 'enter', duration: 0.9, easing: 'easeOutQuart', category: 'Rotate', apply: (s, p) => { s.rotation = -(1 - p) * 720; s.scaleX = p; s.scaleY = p; s.opacity = clamp01(p * 2) } },
  { id: 'swingIn', name: 'Swing In', outName: 'Swing Out', kind: 'enter', duration: 0.9, easing: 'easeOutBack', category: 'Rotate', apply: (s, p) => { s.rotation = -(1 - p) * 60; s.dy = (1 - p) * 30; s.opacity = clamp01(p * 2) } },
  { id: 'flipX', name: 'Flip Horizontal', outName: 'Flip Out Horizontal', kind: 'enter', duration: 0.7, easing: 'easeOutCubic', category: 'Flip', apply: (s, p) => { s.scaleX = Math.cos((1 - p) * Math.PI); s.opacity = clamp01(p * 2) } },
  { id: 'flipY', name: 'Flip Vertical', outName: 'Flip Out Vertical', kind: 'enter', duration: 0.7, easing: 'easeOutCubic', category: 'Flip', apply: (s, p) => { s.scaleY = Math.cos((1 - p) * Math.PI); s.opacity = clamp01(p * 2) } },
  { id: 'blurIn', name: 'Blur In', outName: 'Blur Out', kind: 'enter', duration: 0.8, easing: 'easeOutCubic', category: 'Basic', apply: (s, p) => { s.blur = (1 - p) * 24; s.opacity = p } },
  { id: 'skewIn', name: 'Skew In', outName: 'Skew Out', kind: 'enter', duration: 0.7, easing: 'easeOutBack', category: 'Slide', apply: (s, p, c) => { s.skewX = -(1 - p) * 40; s.dx = -(1 - p) * c.dist * 0.6; s.opacity = clamp01(p * 2) } },
  { id: 'wipeLeft', name: 'Wipe Right →', outName: 'Wipe Out →', kind: 'enter', duration: 0.8, easing: 'easeInOutCubic', category: 'Reveal', apply: (s, p) => { s.reveal = p; s.revealDir = 'left' } },
  { id: 'wipeRight', name: 'Wipe Left ←', outName: 'Wipe Out ←', kind: 'enter', duration: 0.8, easing: 'easeInOutCubic', category: 'Reveal', apply: (s, p) => { s.reveal = p; s.revealDir = 'right' } },
  { id: 'wipeUp', name: 'Wipe Up ↑', outName: 'Wipe Out ↓', kind: 'enter', duration: 0.8, easing: 'easeInOutCubic', category: 'Reveal', apply: (s, p) => { s.reveal = p; s.revealDir = 'up' } },
  { id: 'revealCenter', name: 'Iris Reveal', outName: 'Iris Close', kind: 'enter', duration: 0.8, easing: 'easeInOutCubic', category: 'Reveal', apply: (s, p) => { s.reveal = p; s.revealDir = 'center' } },
  { id: 'glitchIn', name: 'Glitch In', outName: 'Glitch Out', kind: 'enter', duration: 0.8, easing: 'linear', category: 'FX', apply: (s, p, c) => {
    const f = Math.floor(c.time * 24), a = 1 - p
    s.dx = (hash01(f, 1) - 0.5) * 40 * a; s.skewX = (hash01(f, 2) - 0.5) * 30 * a
    s.rgbSplit = 10 * a; s.opacity = p > 0.95 ? 1 : hash01(f, 3) < 0.25 + p * 0.7 ? 1 : 0.15
  } },
  // ——— text: letter-by-letter ———
  { id: 'typewriter', name: 'Typewriter', outName: 'Backspace', kind: 'enter', textOnly: true, raw: true, duration: 1.2, easing: 'linear', category: 'Text', apply: (s, p) => { s.chars = p >= 1 ? Infinity : p } },
  { id: 'letterFade', name: 'Letters Fade', outName: 'Letters Fade Out', kind: 'enter', textOnly: true, raw: true, duration: 1, easing: 'easeOutCubic', category: 'Text', apply: (s, p, c) => perChar(s, (i, n) => ({ ...ID_CHAR, opacity: c.ease(stagger(p, i, n)) })) },
  { id: 'letterRise', name: 'Letters Rise', outName: 'Letters Fall', kind: 'enter', textOnly: true, raw: true, duration: 1, easing: 'easeOutBack', category: 'Text', apply: (s, p, c) => perChar(s, (i, n) => { const l = stagger(p, i, n); return { ...ID_CHAR, dy: (1 - c.ease(l)) * c.fs * 0.9, opacity: clamp01(l * 2) } }) },
  { id: 'letterPop', name: 'Letters Pop', outName: 'Letters Pop Out', kind: 'enter', textOnly: true, raw: true, duration: 1, easing: 'easeOutBack', category: 'Text', apply: (s, p, c) => perChar(s, (i, n) => { const l = stagger(p, i, n); return { ...ID_CHAR, scale: Math.max(0, c.ease(l)), opacity: clamp01(l * 3) } }) },
  { id: 'letterDrop', name: 'Letters Drop', outName: 'Letters Lift', kind: 'enter', textOnly: true, raw: true, duration: 1.2, easing: 'easeOutBounce', category: 'Text', apply: (s, p, c) => perChar(s, (i, n) => { const l = stagger(p, i, n, 4); return { ...ID_CHAR, dy: -(1 - c.ease(l)) * c.fs * 2.5, opacity: clamp01(l * 4) } }) },
  { id: 'letterSpin', name: 'Letters Spin', outName: 'Letters Spin Out', kind: 'enter', textOnly: true, raw: true, duration: 1.1, easing: 'easeOutCubic', category: 'Text', apply: (s, p, c) => perChar(s, (i, n) => { const l = c.ease(stagger(p, i, n)); return { ...ID_CHAR, rotation: -(1 - l) * 360, scale: l, opacity: l } }) },
  { id: 'letterScatter', name: 'Letters Assemble', outName: 'Letters Scatter', kind: 'enter', textOnly: true, raw: true, duration: 1.3, easing: 'easeOutQuart', category: 'Text', apply: (s, p, c) => perChar(s, (i, n) => { const l = c.ease(stagger(p, i, n, n * 0.6 + 2)); const a = 1 - l; return { dx: (hash01(i, 4) - 0.5) * c.fs * 8 * a, dy: (hash01(i, 5) - 0.5) * c.fs * 6 * a, rotation: (hash01(i, 6) - 0.5) * 540 * a, scale: 1 + a * 0.5, opacity: l } }) },
  { id: 'letterBlur', name: 'Letters Focus', outName: 'Letters Unfocus', kind: 'enter', textOnly: true, raw: true, duration: 1, easing: 'easeOutCubic', category: 'Text', apply: (s, p, c) => perChar(s, (i, n) => { const l = c.ease(stagger(p, i, n, 5)); return { ...ID_CHAR, scale: 1 + (1 - l) * 1.6, opacity: l } }) },

  // ——— emphasis (q = phase 0..1) ———
  { id: 'pulse', name: 'Pulse', kind: 'emphasis', duration: 1, easing: 'linear', category: 'Emphasis', apply: (s, q) => { const k = 1 + 0.08 * Math.sin(q * Math.PI * 2); s.scaleX = k; s.scaleY = k } },
  { id: 'heartbeat', name: 'Heartbeat', kind: 'emphasis', duration: 1.2, easing: 'linear', category: 'Emphasis', apply: (s, q) => { const b = q < 0.15 ? Math.sin((q / 0.15) * Math.PI) : q > 0.25 && q < 0.4 ? Math.sin(((q - 0.25) / 0.15) * Math.PI) * 0.7 : 0; const k = 1 + 0.14 * b; s.scaleX = k; s.scaleY = k } },
  { id: 'breathe', name: 'Breathe', kind: 'emphasis', duration: 3, easing: 'linear', category: 'Emphasis', apply: (s, q) => { const v = Math.sin(q * Math.PI * 2); s.scaleX = s.scaleY = 1 + 0.04 * v; s.opacity = 0.88 + 0.12 * v } },
  { id: 'shake', name: 'Shake', kind: 'emphasis', duration: 0.8, easing: 'linear', category: 'Emphasis', apply: (s, q) => { s.dx = Math.sin(q * Math.PI * 12) * 10 * Math.sin(q * Math.PI) } },
  { id: 'vibrate', name: 'Vibrate', kind: 'emphasis', duration: 0.5, easing: 'linear', category: 'Emphasis', apply: (s, _q, c) => { const f = Math.floor(c.time * 40); s.dx = (hash01(f, 7) - 0.5) * 6; s.dy = (hash01(f, 8) - 0.5) * 6 } },
  { id: 'wobble', name: 'Wobble', kind: 'emphasis', duration: 1, easing: 'linear', category: 'Emphasis', apply: (s, q) => { const d = Math.sin(q * Math.PI); s.rotation = Math.sin(q * Math.PI * 6) * 6 * d; s.dx = Math.sin(q * Math.PI * 6) * 14 * d } },
  { id: 'swing', name: 'Swing', kind: 'emphasis', duration: 1.4, easing: 'linear', category: 'Emphasis', apply: (s, q) => { s.rotation = Math.sin(q * Math.PI * 2) * 14 } },
  { id: 'float', name: 'Float', kind: 'emphasis', duration: 2.4, easing: 'linear', category: 'Emphasis', apply: (s, q) => { s.dy = Math.sin(q * Math.PI * 2) * 14; s.rotation = Math.sin(q * Math.PI * 2 + 1) * 2 } },
  { id: 'bounce', name: 'Bounce', kind: 'emphasis', duration: 0.9, easing: 'linear', category: 'Emphasis', apply: (s, q) => { const v = Math.abs(Math.sin(q * Math.PI)); s.dy = -v * 34; s.scaleY = 1 + (v < 0.15 ? (0.15 - v) * -0.8 : 0); s.scaleX = 2 - s.scaleY } },
  { id: 'spin', name: 'Spin', kind: 'emphasis', duration: 2, easing: 'linear', category: 'Emphasis', apply: (s, q) => { s.rotation = q * 360 } },
  { id: 'jello', name: 'Jello', kind: 'emphasis', duration: 1, easing: 'linear', category: 'Emphasis', apply: (s, q) => { s.skewX = Math.sin(q * Math.PI * 6) * 14 * (1 - q) } },
  { id: 'rubberBand', name: 'Rubber Band', kind: 'emphasis', duration: 1, easing: 'linear', category: 'Emphasis', apply: (s, q) => { const v = Math.sin(q * Math.PI * 4) * (1 - q) * 0.3; s.scaleX = 1 + v; s.scaleY = 1 - v } },
  { id: 'tada', name: 'Tada', kind: 'emphasis', duration: 1.2, easing: 'linear', category: 'Emphasis', apply: (s, q) => { const env = Math.sin(q * Math.PI); s.scaleX = s.scaleY = 1 + 0.12 * env; s.rotation = Math.sin(q * Math.PI * 10) * 5 * env } },
  { id: 'flash', name: 'Flash', kind: 'emphasis', duration: 1, easing: 'linear', category: 'Emphasis', apply: (s, q) => { s.opacity = 0.5 + 0.5 * Math.cos(q * Math.PI * 4) } },
  { id: 'flicker', name: 'Neon Flicker', kind: 'emphasis', duration: 2, easing: 'linear', category: 'Emphasis', apply: (s, q, c) => { const f = Math.floor(c.time * 18); s.opacity = (q > 0.1 && q < 0.18) || (q > 0.55 && q < 0.6) ? (hash01(f, 9) > 0.4 ? 0.25 : 1) : 1 } },
  { id: 'glitch', name: 'Glitch', kind: 'emphasis', duration: 1.5, easing: 'linear', category: 'Emphasis', apply: (s, _q, c) => { const f = Math.floor(c.time * 16); const on = hash01(f, 10) > 0.72; s.rgbSplit = on ? 8 : 2; if (on) { s.dx = (hash01(f, 11) - 0.5) * 24; s.skewX = (hash01(f, 12) - 0.5) * 20 } } },
  { id: 'hueCycle', name: 'Rainbow Hue', kind: 'emphasis', duration: 3, easing: 'linear', category: 'Emphasis', apply: (s, q) => { s.hue = q * 360 } },
  { id: 'heartPop', name: 'Squash & Stretch', kind: 'emphasis', duration: 1, easing: 'linear', category: 'Emphasis', apply: (s, q) => { const v = Math.sin(q * Math.PI * 2); s.scaleX = 1 + 0.12 * v; s.scaleY = 1 - 0.12 * v } },
  { id: 'wave', name: 'Letter Wave', kind: 'emphasis', textOnly: true, duration: 1.6, easing: 'linear', category: 'Text', apply: (s, q, c) => perChar(s, (i) => ({ ...ID_CHAR, dy: Math.sin(q * Math.PI * 2 - i * 0.55) * c.fs * 0.22 })) },
  { id: 'letterJump', name: 'Letter Jump', kind: 'emphasis', textOnly: true, duration: 1.6, easing: 'linear', category: 'Text', apply: (s, q, c) => perChar(s, (i, n) => { const ph = clamp01(q * (n + 3) / 1 - i) ; const v = ph > 0 && ph < 1 ? Math.sin(ph * Math.PI) : 0; return { ...ID_CHAR, dy: -v * c.fs * 0.35, scale: 1 + v * 0.1 } }) },
  { id: 'letterWiggle', name: 'Letter Wiggle', kind: 'emphasis', textOnly: true, duration: 1, easing: 'linear', category: 'Text', apply: (s, q) => perChar(s, (i) => ({ ...ID_CHAR, rotation: Math.sin(q * Math.PI * 2 + i * 1.3) * 10 })) },
  { id: 'letterPulse', name: 'Letter Pulse', kind: 'emphasis', textOnly: true, duration: 1.4, easing: 'linear', category: 'Text', apply: (s, q) => perChar(s, (i) => ({ ...ID_CHAR, scale: 1 + 0.18 * Math.max(0, Math.sin(q * Math.PI * 2 - i * 0.6)) })) },
]

export interface PresetInfo { id: string; name: string; kind: PresetKind; textOnly: boolean; duration: number; easing: string; category: string }

const BY_ID = new Map(DEFS.map((d) => [d.id, d]))

export const PRESETS: PresetInfo[] = [
  ...DEFS.filter((d) => d.kind === 'enter').map((d) => ({ id: d.id, name: d.name, kind: 'enter' as const, textOnly: !!d.textOnly, duration: d.duration, easing: d.easing, category: d.category })),
  ...DEFS.filter((d) => d.kind === 'enter').map((d) => ({ id: d.id, name: d.outName ?? d.name + ' Out', kind: 'exit' as const, textOnly: !!d.textOnly, duration: d.duration, easing: invertEasing(d.easing), category: d.category })),
  ...DEFS.filter((d) => d.kind === 'emphasis').map((d) => ({ id: d.id, name: d.name, kind: 'emphasis' as const, textOnly: !!d.textOnly, duration: d.duration, easing: d.easing, category: d.category })),
]

function invertEasing(e: string): string {
  if (e.startsWith('easeOut')) return 'easeIn' + e.slice(7)
  return e
}

export function presetsOf(kind: PresetKind) { return PRESETS.filter((p) => p.kind === kind) }
export function presetInfo(kind: PresetKind, id: string) { return PRESETS.find((p) => p.kind === kind && p.id === id) }

export function makeClip(kind: PresetKind, id: string): PresetClip {
  const info = presetInfo(kind, id)
  return { preset: id, duration: info?.duration ?? 0.6, delay: 0, easing: info?.easing ?? 'easeOutCubic', loop: kind === 'emphasis' ? true : undefined }
}

function compose(acc: AnimState, s: AnimState) {
  acc.dx += s.dx; acc.dy += s.dy
  acc.scaleX *= s.scaleX; acc.scaleY *= s.scaleY
  acc.rotation += s.rotation; acc.opacity *= s.opacity
  acc.skewX += s.skewX; acc.blur += s.blur; acc.hue += s.hue
  if (s.reveal < acc.reveal) { acc.reveal = s.reveal; acc.revealDir = s.revealDir }
  acc.chars = Math.min(acc.chars, s.chars)
  acc.rgbSplit = Math.max(acc.rgbSplit, s.rgbSplit)
  if (s.perChar) {
    const prev = acc.perChar, next = s.perChar
    acc.perChar = prev
      ? (i, n) => { const a = prev(i, n), b = next(i, n); return { dx: a.dx + b.dx, dy: a.dy + b.dy, scale: a.scale * b.scale, rotation: a.rotation + b.rotation, opacity: a.opacity * b.opacity } }
      : next
  }
}

function runPreset(def: PresetDef, p: number, clip: PresetClip, c: Omit<PresetCtx, 'ease'>): AnimState {
  const s = identityState()
  const fn = getEasing(clip.easing)
  const pp = def.raw ? p : fn(p)
  def.apply(s, pp, { ...c, ease: fn })
  return s
}

export interface Evaluated {
  visible: boolean
  x: number; y: number; rotation: number; scale: number; opacity: number
  state: AnimState
}

/** Evaluate the element's animated properties at scene time t. */
export function evaluate(el: DesignElement, t: number, fs = 40): Evaluated {
  const a = el.anim
  const kf = a.keyframes ?? {}
  const base = {
    x: interpolate(kf.x, t, el.x),
    y: interpolate(kf.y, t, el.y),
    rotation: interpolate(kf.rotation, t, el.rotation),
    scale: interpolate(kf.scale, t, 1),
    opacity: interpolate(kf.opacity, t, 1),
  }
  const state = identityState()
  const visible = t >= a.start - 1e-6 && t <= a.end + 1e-6
  if (!visible) return { visible, ...base, state }
  const ctx = { w: el.width, h: el.height, fs, time: t, dist: Math.max(160, Math.min(500, el.width * 0.8)) }

  if (a.enter) {
    const def = BY_ID.get(a.enter.preset)
    if (def) {
      const t0 = a.start + (a.enter.delay || 0)
      const p = clamp01((t - t0) / Math.max(0.01, a.enter.duration))
      if (p < 1) compose(state, runPreset(def, p, a.enter, ctx))
    }
  }
  if (a.exit) {
    const def = BY_ID.get(a.exit.preset)
    if (def) {
      const t0 = a.end - a.exit.duration
      const p = clamp01((t - t0) / Math.max(0.01, a.exit.duration))
      if (p > 0) {
        // exits replay the entrance in reverse
        const fn = getEasing(a.exit.easing)
        const s = identityState()
        const rev = def.raw ? 1 - p : 1 - fn(p)
        def.apply(s, rev, { ...ctx, ease: (x) => 1 - fn(1 - x) })
        compose(state, s)
      }
    }
  }
  if (a.emphasis) {
    const def = BY_ID.get(a.emphasis.preset)
    if (def) {
      const t0 = a.start + (a.enter && !a.emphasis.delay ? 0 : 0) + (a.emphasis.delay || 0)
      const d = Math.max(0.05, a.emphasis.duration)
      const local = t - t0
      if (local >= 0 && (a.emphasis.loop || local <= d)) {
        const q = a.emphasis.loop ? (local % d) / d : clamp01(local / d)
        const s = identityState()
        def.apply(s, ease(a.emphasis.easing, q), { ...ctx, ease: getEasing('linear') })
        compose(state, s)
      }
    }
  }
  return { visible, ...base, state }
}

export const KEYFRAME_PROPS: AnimProp[] = ['x', 'y', 'scale', 'rotation', 'opacity']
