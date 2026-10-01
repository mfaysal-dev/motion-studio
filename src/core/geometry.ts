import type { DesignElement, PathElement } from './types'

export interface Rect { x: number; y: number; w: number; h: number }
export interface Pt { x: number; y: number }

const RAD = Math.PI / 180

export function corners(el: Pick<DesignElement, 'x' | 'y' | 'width' | 'height' | 'rotation'>): Pt[] {
  const c = Math.cos(el.rotation * RAD), s = Math.sin(el.rotation * RAD)
  const hw = el.width / 2, hh = el.height / 2
  return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([x, y]) => ({ x: el.x + x * c - y * s, y: el.y + x * s + y * c }))
}

export function aabb(el: Pick<DesignElement, 'x' | 'y' | 'width' | 'height' | 'rotation'>): Rect {
  const pts = corners(el)
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y)
  const x = Math.min(...xs), y = Math.min(...ys)
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
}

export function unionRects(rs: Rect[]): Rect | null {
  if (!rs.length) return null
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const r of rs) { x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y); x1 = Math.max(x1, r.x + r.w); y1 = Math.max(y1, r.y + r.h) }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

export function toLocal(el: Pick<DesignElement, 'x' | 'y' | 'rotation'>, p: Pt): Pt {
  const c = Math.cos(-el.rotation * RAD), s = Math.sin(-el.rotation * RAD)
  const dx = p.x - el.x, dy = p.y - el.y
  return { x: dx * c - dy * s, y: dx * s + dy * c }
}

function distSeg(p: Pt, a: Pt, b: Pt) {
  const dx = b.x - a.x, dy = b.y - a.y
  const l2 = dx * dx + dy * dy
  let t = l2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2 : 0
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

export function hitTest(el: DesignElement, p: Pt, tol = 4): boolean {
  const l = toLocal(el, p)
  const hw = Math.abs(el.width) / 2 + tol, hh = Math.abs(el.height) / 2 + tol
  if (Math.abs(l.x) > hw || Math.abs(l.y) > hh) return false
  if (el.type === 'path' && !(el as PathElement).closed) {
    const pe = el as PathElement
    const sx = el.width / (pe.baseW || 1), sy = el.height / (pe.baseH || 1)
    const pts = pe.points.map((q) => ({ x: q.x * sx - el.width / 2, y: q.y * sy - el.height / 2 }))
    const r = el.stroke.width / 2 + tol
    if (pts.length === 1) return Math.hypot(l.x - pts[0].x, l.y - pts[0].y) <= r
    for (let i = 0; i < pts.length - 1; i++) if (distSeg(l, pts[i], pts[i + 1]) <= r) return true
    return false
  }
  if (el.type === 'line' || el.type === 'arrow') return Math.abs(l.y) <= Math.max(el.stroke.width / 2, 6) + tol
  if (el.type === 'ellipse') {
    const a = el.width / 2 + tol, b = el.height / 2 + tol
    return (l.x * l.x) / (a * a) + (l.y * l.y) / (b * b) <= 1
  }
  return true
}

export function rectsIntersect(a: Rect, b: Rect) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

/** Ramer–Douglas–Peucker simplification + Chaikin-free exponential smoothing for freehand input. */
export function smoothPoints(pts: Pt[], smoothing: number): Pt[] {
  if (pts.length < 3 || smoothing <= 0) return pts
  const k = Math.min(0.9, smoothing)
  const out: Pt[] = [pts[0]]
  let prev = pts[0]
  for (let i = 1; i < pts.length; i++) {
    const p = { x: prev.x + (pts[i].x - prev.x) * (1 - k), y: prev.y + (pts[i].y - prev.y) * (1 - k) }
    out.push(p)
    prev = p
  }
  out.push(pts[pts.length - 1])
  return simplify(out, 0.4 + smoothing)
}

export function simplify(pts: Pt[], eps: number): Pt[] {
  if (pts.length < 3) return pts
  let maxD = 0, idx = 0
  const a = pts[0], b = pts[pts.length - 1]
  for (let i = 1; i < pts.length - 1; i++) {
    const d = distSeg(pts[i], a, b)
    if (d > maxD) { maxD = d; idx = i }
  }
  if (maxD > eps) {
    const l = simplify(pts.slice(0, idx + 1), eps)
    const r = simplify(pts.slice(idx), eps)
    return [...l.slice(0, -1), ...r]
  }
  return [a, b]
}

export interface SnapResult { dx: number; dy: number; guides: { axis: 'x' | 'y'; pos: number }[] }

/** Snap a moving rect to candidate x/y lines. */
export function snapRect(r: Rect, xs: number[], ys: number[], threshold: number): SnapResult {
  const guides: SnapResult['guides'] = []
  const mx = [r.x, r.x + r.w / 2, r.x + r.w]
  const my = [r.y, r.y + r.h / 2, r.y + r.h]
  let bestX: { d: number; pos: number } | null = null
  for (const m of mx) for (const c of xs) { const d = c - m; if (Math.abs(d) <= threshold && (!bestX || Math.abs(d) < Math.abs(bestX.d))) bestX = { d, pos: c } }
  let bestY: { d: number; pos: number } | null = null
  for (const m of my) for (const c of ys) { const d = c - m; if (Math.abs(d) <= threshold && (!bestY || Math.abs(d) < Math.abs(bestY.d))) bestY = { d, pos: c } }
  if (bestX) guides.push({ axis: 'x', pos: bestX.pos })
  if (bestY) guides.push({ axis: 'y', pos: bestY.pos })
  return { dx: bestX?.d ?? 0, dy: bestY?.d ?? 0, guides }
}
