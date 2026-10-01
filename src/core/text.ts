import type { TextElement } from './types'

export interface Glyph { ch: string; x: number; y: number; rot: number; w: number }
export interface TextLayout { glyphs: Glyph[]; width: number; height: number }

let measureCtx: CanvasRenderingContext2D | null = null
function mctx(): CanvasRenderingContext2D | null {
  if (measureCtx) return measureCtx
  if (typeof document === 'undefined') return null
  measureCtx = document.createElement('canvas').getContext('2d')
  return measureCtx
}

export function fontString(el: Pick<TextElement, 'italic' | 'fontWeight' | 'fontSize' | 'fontFamily'>, size = el.fontSize) {
  return `${el.italic ? 'italic ' : ''}${el.fontWeight} ${size}px "${el.fontFamily}", "Inter", sans-serif`
}

export function displayText(el: Pick<TextElement, 'text' | 'transform'>) {
  return el.transform === 'uppercase' ? el.text.toUpperCase() : el.transform === 'lowercase' ? el.text.toLowerCase() : el.text
}

let version = 0
export function bumpTextVersion() { version++; cache.clear() }
const cache = new Map<string, TextLayout>()

/** Split a string into user-perceived characters (keeps Bangla/emoji clusters together). */
export function splitGraphemes(s: string): string[] {
  const Seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: object) => { segment(s: string): Iterable<{ segment: string }> } }).Segmenter
  if (Seg) return Array.from(new Seg(undefined, { granularity: 'grapheme' }).segment(s), (x) => x.segment)
  return Array.from(s)
}

export function layoutText(el: TextElement): TextLayout {
  const key = [version, el.text, el.transform, el.fontFamily, el.fontSize, el.fontWeight, el.italic, el.letterSpacing, el.lineHeight, el.align, el.warp, el.warpAmount].join('|')
  const hit = cache.get(key)
  if (hit) return hit
  const ctx = mctx()
  const fs = el.fontSize
  const measure = (s: string) => (ctx ? ctx.measureText(s).width : s.length * fs * 0.55)
  if (ctx) ctx.font = fontString(el)
  let lines = displayText(el).split('\n')
  const warp = el.warp
  if (warp === 'arc' || warp === 'circle') lines = [lines.join(' ')]
  const lineH = fs * el.lineHeight
  const ls = el.letterSpacing
  const rows = lines.map((line) => {
    const chars = splitGraphemes(line)
    const items: { ch: string; cx: number; w: number }[] = []
    let prefix = ''
    let prevW = 0
    chars.forEach((ch, i) => {
      prefix += ch
      const wNow = measure(prefix)
      const w = wNow - prevW
      items.push({ ch, cx: prevW + i * ls + w / 2, w })
      prevW = wNow
    })
    const width = prevW + Math.max(0, chars.length - 1) * ls
    return { items, width }
  })
  const W = Math.max(1, ...rows.map((r) => r.width))
  const H = Math.max(lineH, rows.length * lineH)
  const glyphs: Glyph[] = []
  rows.forEach((r, li) => {
    const off = el.align === 'left' ? -W / 2 : el.align === 'right' ? W / 2 - r.width : -r.width / 2
    const y = -H / 2 + lineH * (li + 0.5)
    for (const it of r.items) glyphs.push({ ch: it.ch, x: off + it.cx, y, rot: 0, w: it.w })
  })

  let result: TextLayout
  if (warp === 'none' || glyphs.length === 0 || (warp === 'arc' && Math.abs(el.warpAmount) < 1)) {
    result = { glyphs, width: W, height: H }
  } else {
    if (warp === 'wave') {
      const amp = (el.warpAmount / 100) * fs * 0.6
      for (const g of glyphs) {
        const k = (2 * Math.PI * 1.5) / Math.max(W, 1)
        g.y += amp * Math.sin(g.x * k)
        g.rot = Math.atan(amp * k * Math.cos(g.x * k))
      }
    } else {
      const total = warp === 'circle' ? 2 * Math.PI : (Math.min(360, Math.abs(el.warpAmount)) * Math.PI) / 180
      const up = warp === 'circle' || el.warpAmount > 0
      const R = warp === 'circle' ? (W + fs * 0.6) / (2 * Math.PI) : W / total
      for (const g of glyphs) {
        const th = g.x / R
        g.x = R * Math.sin(th)
        g.y = up ? R - R * Math.cos(th) : R * Math.cos(th) - R
        g.rot = up ? th : -th
      }
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    const pad = fs * 0.55
    for (const g of glyphs) {
      minX = Math.min(minX, g.x - pad); maxX = Math.max(maxX, g.x + pad)
      minY = Math.min(minY, g.y - pad); maxY = Math.max(maxY, g.y + pad)
    }
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2
    for (const g of glyphs) { g.x -= cx; g.y -= cy }
    result = { glyphs, width: maxX - minX, height: maxY - minY }
  }
  cache.set(key, result)
  if (cache.size > 500) cache.clear()
  return result
}
