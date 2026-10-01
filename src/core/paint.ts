import type { Fill } from './types'
import { getImage } from './images'

export interface Box { x: number; y: number; w: number; h: number }

const tileCache = new Map<string, HTMLCanvasElement>()

function tile(name: string, a: string, b: string): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null
  const key = `${name}|${a}|${b}`
  const hit = tileCache.get(key)
  if (hit) return hit
  const c = document.createElement('canvas')
  const s = 40
  c.width = s; c.height = s
  const g = c.getContext('2d')!
  g.fillStyle = a; g.fillRect(0, 0, s, s)
  g.fillStyle = b; g.strokeStyle = b
  switch (name) {
    case 'stripes':
      g.lineWidth = 10
      for (let i = -s; i < s * 2; i += 20) { g.beginPath(); g.moveTo(i, s); g.lineTo(i + s, 0); g.stroke() }
      break
    case 'dots':
      for (const [x, y] of [[10, 10], [30, 30]]) { g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.fill() }
      break
    case 'checker':
      g.fillRect(0, 0, 20, 20); g.fillRect(20, 20, 20, 20)
      break
    case 'grid':
      g.lineWidth = 2; g.strokeRect(0, 0, s, s)
      break
    case 'zigzag':
      g.lineWidth = 5; g.beginPath(); g.moveTo(0, 26); g.lineTo(10, 14); g.lineTo(20, 26); g.lineTo(30, 14); g.lineTo(40, 26); g.stroke()
      break
    case 'noise': {
      const img = g.getImageData(0, 0, s, s)
      for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 90 - 45; img.data[i] += v; img.data[i + 1] += v; img.data[i + 2] += v }
      g.putImageData(img, 0, 0)
      break
    }
    case 'confetti':
      for (let i = 0; i < 7; i++) { g.save(); g.translate((i * 37) % s, (i * 23) % s); g.rotate(i); g.fillStyle = ['#ff5ca8', '#ffd166', '#06d6a0', '#4cc9f0', b][i % 5]; g.fillRect(-4, -2, 8, 4); g.restore() }
      break
    case 'halftone':
      for (let y = 0; y < s; y += 8) for (let x = 0; x < s; x += 8) { g.beginPath(); g.arc(x + 4, y + 4, 1 + (y / s) * 3, 0, Math.PI * 2); g.fill() }
      break
    default:
      break
  }
  tileCache.set(key, c)
  return c
}

export const PATTERNS = ['stripes', 'dots', 'checker', 'grid', 'zigzag', 'noise', 'confetti', 'halftone', 'image']

export function makePaint(ctx: CanvasRenderingContext2D, fill: Fill, box: Box): string | CanvasGradient | CanvasPattern | null {
  switch (fill.type) {
    case 'none':
      return null
    case 'solid':
      return fill.color
    case 'linear': {
      const a = ((fill.angle - 90) * Math.PI) / 180
      const cx = box.x + box.w / 2, cy = box.y + box.h / 2
      const len = (Math.abs(box.w * Math.cos(a)) + Math.abs(box.h * Math.sin(a))) / 2
      const g = ctx.createLinearGradient(cx - Math.cos(a) * len, cy - Math.sin(a) * len, cx + Math.cos(a) * len, cy + Math.sin(a) * len)
      for (const s of fill.stops) g.addColorStop(Math.min(1, Math.max(0, s.offset)), s.color)
      return g
    }
    case 'radial': {
      const cx = box.x + box.w / 2, cy = box.y + box.h / 2
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(box.w, box.h) / 2)
      for (const s of fill.stops) g.addColorStop(Math.min(1, Math.max(0, s.offset)), s.color)
      return g
    }
    case 'pattern': {
      if (fill.pattern === 'image' || fill.src) {
        const img = fill.src ? getImage(fill.src) : null
        if (!img) return '#888'
        const p = ctx.createPattern(img, 'repeat')
        if (!p) return '#888'
        const s = Math.max(box.w / img.naturalWidth, box.h / img.naturalHeight) * (fill.scale || 1)
        p.setTransform(new DOMMatrix().translate(box.x, box.y).scale(s))
        return p
      }
      const t = tile(fill.pattern, fill.colors?.[0] ?? '#14141f', fill.colors?.[1] ?? '#7c5cff')
      if (!t) return '#888'
      const p = ctx.createPattern(t, 'repeat')
      if (!p) return '#888'
      p.setTransform(new DOMMatrix().translate(box.x, box.y).scale(fill.scale || 1))
      return p
    }
  }
}

/** CSS representation for UI swatches */
export function fillToCss(fill: Fill): string {
  switch (fill.type) {
    case 'none': return 'transparent'
    case 'solid': return fill.color
    case 'linear': return `linear-gradient(${fill.angle}deg, ${fill.stops.map((s) => `${s.color} ${Math.round(s.offset * 100)}%`).join(', ')})`
    case 'radial': return `radial-gradient(circle, ${fill.stops.map((s) => `${s.color} ${Math.round(s.offset * 100)}%`).join(', ')})`
    case 'pattern': return fill.src ? `url(${fill.src}) center/cover` : `repeating-linear-gradient(45deg, ${fill.colors?.[0] ?? '#14141f'} 0 6px, ${fill.colors?.[1] ?? '#7c5cff'} 6px 12px)`
  }
}

export function primaryColor(fill: Fill): string {
  switch (fill.type) {
    case 'solid': return fill.color
    case 'linear': case 'radial': return fill.stops[0]?.color ?? '#ffffff'
    case 'pattern': return fill.colors?.[1] ?? '#7c5cff'
    default: return '#ffffff'
  }
}
