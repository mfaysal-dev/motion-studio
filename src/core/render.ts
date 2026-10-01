import type { AnimState, DesignElement, ImageElement, PathElement, Project, ShapeElement, TextElement, ImageFilters } from './types'
import { evaluate, identityState, type Evaluated } from './animate'
import { makePaint, type Box } from './paint'
import { getImage } from './images'
import { fontString, layoutText } from './text'

export interface RenderOptions {
  time: number
  /** apply presets & visibility windows */
  animate: boolean
  hiddenIds?: Set<string>
  /** draw a background (false for transparent PNG) */
  background?: boolean
}

const RAD = Math.PI / 180

export function pxScale(ctx: CanvasRenderingContext2D) {
  const m = ctx.getTransform()
  return Math.hypot(m.a, m.b) || 1
}

export function staticEval(el: DesignElement, t: number): Evaluated {
  const e = evaluate(el, t)
  return { ...e, visible: true, state: identityState() }
}

export function evalFor(el: DesignElement, opts: RenderOptions): Evaluated {
  const fs = el.type === 'text' ? el.fontSize : 40
  return opts.animate ? evaluate(el, opts.time, fs) : staticEval(el, opts.time)
}

let layerCanvas: HTMLCanvasElement | OffscreenCanvas | null = null

function getLayer(w: number, h: number): CanvasRenderingContext2D {
  if (!layerCanvas) layerCanvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : document.createElement('canvas')
  if (layerCanvas.width !== w) layerCanvas.width = w
  if (layerCanvas.height !== h) layerCanvas.height = h
  return layerCanvas.getContext('2d') as unknown as CanvasRenderingContext2D
}

export function drawBackground(ctx: CanvasRenderingContext2D, project: Project) {
  const { width: W, height: H, background } = project.artboard
  const paint = makePaint(ctx, background, { x: 0, y: 0, w: W, h: H })
  if (paint) { ctx.fillStyle = paint; ctx.fillRect(0, 0, W, H) }
}

/** Render the artboard content. ctx must already map artboard px → canvas px. */
export function renderScene(ctx: CanvasRenderingContext2D, project: Project, opts: RenderOptions) {
  const { width: W, height: H } = project.artboard
  const useLayer = project.elements.some((e) => e.type === 'path' && e.brush === 'eraser' && e.visible)
  const clip = (c: CanvasRenderingContext2D) => { c.beginPath(); c.rect(0, 0, W, H); c.clip() }
  ctx.save()
  clip(ctx)
  if (opts.background !== false) drawBackground(ctx, project)
  let target = ctx
  if (useLayer) {
    const l = getLayer(ctx.canvas.width, ctx.canvas.height)
    l.setTransform(1, 0, 0, 1, 0, 0)
    l.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    l.setTransform(ctx.getTransform())
    l.save()
    clip(l)
    if (opts.background !== false) drawBackground(l, project)
    target = l
  }
  for (const el of project.elements) {
    if (!el.visible || opts.hiddenIds?.has(el.id)) continue
    drawElement(target, el, evalFor(el, opts))
  }
  if (useLayer) {
    target.restore()
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.drawImage(target.canvas as CanvasImageSource, 0, 0)
    ctx.restore()
  }
  ctx.restore()
}

function filterString(st: AnimState, px: number, f?: ImageFilters): string {
  const parts: string[] = []
  if (f) {
    if (f.brightness !== 100) parts.push(`brightness(${f.brightness}%)`)
    if (f.contrast !== 100) parts.push(`contrast(${f.contrast}%)`)
    if (f.saturate !== 100) parts.push(`saturate(${f.saturate}%)`)
    if (f.grayscale) parts.push(`grayscale(${f.grayscale}%)`)
    if (f.sepia) parts.push(`sepia(${f.sepia}%)`)
    if (f.invert) parts.push(`invert(${f.invert}%)`)
    if (f.hueRotate) parts.push(`hue-rotate(${f.hueRotate}deg)`)
  }
  const blur = st.blur + (f?.blur ?? 0)
  if (blur > 0.05) parts.push(`blur(${(blur * px).toFixed(2)}px)`)
  if (st.hue) parts.push(`hue-rotate(${st.hue.toFixed(1)}deg)`)
  return parts.length ? parts.join(' ') : 'none'
}

export function drawElement(ctx: CanvasRenderingContext2D, el: DesignElement, ev: Evaluated) {
  if (!ev.visible) return
  const st = ev.state
  const alpha = el.opacity * ev.opacity * st.opacity
  if (alpha <= 0.002) return
  ctx.save()
  ctx.globalAlpha *= Math.min(1, Math.max(0, alpha))
  ctx.globalCompositeOperation = el.type === 'path' && el.brush === 'eraser' ? 'destination-out' : el.blendMode
  ctx.translate(ev.x + st.dx, ev.y + st.dy)
  ctx.rotate((ev.rotation + st.rotation) * RAD)
  if (st.skewX) ctx.transform(1, 0, Math.tan(st.skewX * RAD), 1, 0, 0)
  const sx = ev.scale * st.scaleX, sy = ev.scale * st.scaleY
  if (Math.abs(sx) < 1e-4 || Math.abs(sy) < 1e-4) { ctx.restore(); return }
  ctx.scale(sx, sy)
  const px = pxScale(ctx)
  const filter = filterString(st, px, el.type === 'image' ? el.filters : undefined)
  if (filter !== 'none') ctx.filter = filter
  if (st.reveal < 1) {
    const w = el.width, h = el.height
    const pad = Math.max(w, h) * 0.35 + 40
    const r = Math.max(0, st.reveal)
    ctx.beginPath()
    if (st.revealDir === 'center') ctx.arc(0, 0, (Math.hypot(w, h) / 2 + pad) * r, 0, Math.PI * 2)
    else if (st.revealDir === 'left') ctx.rect(-w / 2 - pad, -h / 2 - pad, (w + pad * 2) * r, h + pad * 2)
    else if (st.revealDir === 'right') ctx.rect(w / 2 + pad - (w + pad * 2) * r, -h / 2 - pad, (w + pad * 2) * r, h + pad * 2)
    else ctx.rect(-w / 2 - pad, h / 2 + pad - (h + pad * 2) * r, w + pad * 2, (h + pad * 2) * r)
    ctx.clip()
  }
  switch (el.type) {
    case 'text': drawText(ctx, el, st, px); break
    case 'path': drawPath(ctx, el, px); break
    case 'image': drawImageEl(ctx, el, px); break
    default: drawShape(ctx, el as ShapeElement, px)
  }
  ctx.restore()
}

function setShadow(ctx: CanvasRenderingContext2D, el: DesignElement, px: number) {
  ctx.shadowColor = el.shadow.color
  ctx.shadowBlur = el.shadow.blur * px
  ctx.shadowOffsetX = el.shadow.offsetX * px
  ctx.shadowOffsetY = el.shadow.offsetY * px
}
function clearShadow(ctx: CanvasRenderingContext2D) {
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0
}

export function shapePath(ctx: CanvasRenderingContext2D, el: ShapeElement) {
  const w = el.width, h = el.height
  ctx.beginPath()
  switch (el.type) {
    case 'rect': {
      const r = Math.min(el.radius ?? 0, w / 2, h / 2)
      if (r > 0 && ctx.roundRect) ctx.roundRect(-w / 2, -h / 2, w, h, r)
      else ctx.rect(-w / 2, -h / 2, w, h)
      break
    }
    case 'ellipse': ctx.ellipse(0, 0, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2); break
    case 'polygon': case 'star': {
      const n = Math.max(3, el.sides ?? 5)
      const pts = el.type === 'star' ? n * 2 : n
      for (let i = 0; i < pts; i++) {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / pts
        const rr = el.type === 'star' && i % 2 === 1 ? (el.innerRatio ?? 0.45) : 1
        const x = Math.cos(a) * (w / 2) * rr, y = Math.sin(a) * (h / 2) * rr
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
      }
      ctx.closePath()
      break
    }
    case 'line': ctx.moveTo(-w / 2, 0); ctx.lineTo(w / 2, 0); break
    case 'arrow': {
      const head = Math.min(w * 0.4, Math.max(18, el.stroke.width * 3.2))
      ctx.moveTo(-w / 2, 0); ctx.lineTo(w / 2 - head * 0.6, 0)
      break
    }
  }
}

function arrowHead(ctx: CanvasRenderingContext2D, el: ShapeElement) {
  const w = el.width
  const head = Math.min(w * 0.4, Math.max(18, el.stroke.width * 3.2))
  ctx.beginPath()
  ctx.moveTo(w / 2, 0)
  ctx.lineTo(w / 2 - head, -head * 0.6)
  ctx.lineTo(w / 2 - head, head * 0.6)
  ctx.closePath()
}

function drawShape(ctx: CanvasRenderingContext2D, el: ShapeElement, px: number) {
  const box: Box = { x: -el.width / 2, y: -el.height / 2, w: el.width, h: el.height }
  const isLine = el.type === 'line' || el.type === 'arrow'
  const paint = makePaint(ctx, el.fill, box)
  const strokePaint = el.stroke.enabled ? el.stroke.color : null
  const doFill = () => { if (!isLine && paint) { shapePath(ctx, el); ctx.fillStyle = paint; ctx.fill() } }
  const doStroke = () => {
    if (!strokePaint) return
    ctx.lineWidth = el.stroke.width
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    ctx.setLineDash(el.stroke.dash ? [el.stroke.dash, el.stroke.dash * 0.8] : [])
    ctx.strokeStyle = strokePaint
    shapePath(ctx, el); ctx.stroke()
    ctx.setLineDash([])
    if (el.type === 'arrow') { arrowHead(ctx, el); ctx.fillStyle = strokePaint; ctx.fill() }
  }
  if (el.glow.enabled) {
    ctx.save()
    ctx.shadowColor = el.glow.color; ctx.shadowBlur = el.glow.blur * px
    for (let i = 0; i < el.glow.strength; i++) { doFill(); doStroke() }
    ctx.restore()
  }
  if (el.shadow.enabled) setShadow(ctx, el, px)
  if (!isLine && paint) { doFill(); clearShadow(ctx) }
  doStroke()
}

function drawPath(ctx: CanvasRenderingContext2D, el: PathElement, px: number) {
  const pts = el.points
  if (pts.length === 0) return
  const sx = el.width / (el.baseW || 1), sy = el.height / (el.baseH || 1)
  const P = pts.map((p) => ({ x: p.x * sx - el.width / 2, y: p.y * sy - el.height / 2 }))
  const build = () => {
    ctx.beginPath()
    ctx.moveTo(P[0].x, P[0].y)
    if (P.length === 1) { ctx.lineTo(P[0].x + 0.01, P[0].y) }
    else if (el.smooth && P.length > 2) {
      for (let i = 1; i < P.length - 1; i++) {
        const mx = (P[i].x + P[i + 1].x) / 2, my = (P[i].y + P[i + 1].y) / 2
        ctx.quadraticCurveTo(P[i].x, P[i].y, mx, my)
      }
      const l = P[P.length - 1]
      ctx.lineTo(l.x, l.y)
    } else for (let i = 1; i < P.length; i++) ctx.lineTo(P[i].x, P[i].y)
    if (el.closed) ctx.closePath()
  }
  const box: Box = { x: -el.width / 2, y: -el.height / 2, w: el.width, h: el.height }
  const paint = el.closed ? makePaint(ctx, el.fill, box) : null
  const sw = el.stroke.width
  ctx.lineCap = el.brush === 'highlighter' || el.brush === 'marker' ? 'square' : 'round'
  ctx.lineJoin = 'round'
  if (el.brush === 'highlighter' && el.blendMode === 'source-over') ctx.globalCompositeOperation = 'multiply'
  if (el.brush === 'marker') ctx.lineCap = 'round'
  const strokeIt = (color: string | CanvasGradient | CanvasPattern) => {
    ctx.lineWidth = sw
    ctx.strokeStyle = color
    build(); ctx.stroke()
  }
  if (el.brush === 'eraser') { strokeIt('#000'); return }
  if (el.glow.enabled) {
    ctx.save()
    ctx.shadowColor = el.glow.color; ctx.shadowBlur = el.glow.blur * px
    for (let i = 0; i < el.glow.strength; i++) { if (paint) { build(); ctx.fillStyle = paint; ctx.fill() } if (el.stroke.enabled) strokeIt(el.stroke.color) }
    ctx.restore()
  }
  if (el.shadow.enabled) setShadow(ctx, el, px)
  if (paint) { build(); ctx.fillStyle = paint; ctx.fill(); clearShadow(ctx) }
  if (!el.stroke.enabled) return
  if (el.brush === 'brush') { ctx.shadowColor = el.stroke.color; ctx.shadowBlur = Math.max(1, sw * 0.35) * px }
  // a stroke may use the element fill as a gradient brush
  const strokePaint = !el.closed && el.fill.type !== 'none' && el.fill.type !== 'solid' ? makePaint(ctx, el.fill, box) ?? el.stroke.color : el.stroke.color
  strokeIt(strokePaint)
  if (el.brush === 'pencil') {
    clearShadow(ctx)
    ctx.globalAlpha *= 0.35
    ctx.save(); ctx.translate(0.6, 0.4); ctx.lineWidth = Math.max(1, sw * 0.6); ctx.strokeStyle = strokePaint; build(); ctx.stroke(); ctx.restore()
  }
}

function drawImageEl(ctx: CanvasRenderingContext2D, el: ImageElement, px: number) {
  const w = el.width, h = el.height
  const img = getImage(el.src)
  const rr = () => {
    ctx.beginPath()
    if (el.radius > 0 && ctx.roundRect) ctx.roundRect(-w / 2, -h / 2, w, h, Math.min(el.radius, w / 2, h / 2))
    else ctx.rect(-w / 2, -h / 2, w, h)
  }
  if (el.shadow.enabled || el.glow.enabled) {
    ctx.save()
    if (el.glow.enabled) { ctx.shadowColor = el.glow.color; ctx.shadowBlur = el.glow.blur * px; ctx.fillStyle = el.glow.color; for (let i = 0; i < el.glow.strength; i++) { rr(); ctx.fill() } }
    if (el.shadow.enabled) { setShadow(ctx, el, px); ctx.fillStyle = '#000'; rr(); ctx.fill() }
    ctx.restore()
  }
  ctx.save()
  rr(); ctx.clip()
  if (img) ctx.drawImage(img, -w / 2, -h / 2, w, h)
  else { ctx.fillStyle = '#2a2a38'; ctx.fillRect(-w / 2, -h / 2, w, h) }
  ctx.restore()
  if (el.stroke.enabled) { ctx.filter = 'none'; ctx.lineWidth = el.stroke.width; ctx.strokeStyle = el.stroke.color; rr(); ctx.stroke() }
}

function shade(hex: string, amt: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return hex
  const n = parseInt(m[1], 16)
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v + amt * 255)))
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`
}

function drawText(ctx: CanvasRenderingContext2D, el: TextElement, st: AnimState, px: number) {
  const L = layoutText(el)
  const n = L.glyphs.length
  if (!n) return
  ctx.font = fontString(el)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.miterLimit = 2
  const visibleN = st.chars >= 1 ? n : Math.floor(st.chars * n + 1e-9)
  const chars = st.perChar ? L.glyphs.map((_, i) => st.perChar!(i, n)) : null
  const glyphs = (mode: 'fill' | 'stroke', ox = 0, oy = 0) => {
    for (let i = 0; i < visibleN; i++) {
      const g = L.glyphs[i]
      if (g.ch === ' ') continue
      const c = chars?.[i]
      if (c && c.opacity <= 0.002) continue
      ctx.save()
      ctx.translate(g.x + ox + (c?.dx ?? 0), g.y + oy + (c?.dy ?? 0))
      const r = g.rot + (c ? c.rotation * RAD : 0)
      if (r) ctx.rotate(r)
      if (c && c.scale !== 1) ctx.scale(Math.max(0.0001, c.scale), Math.max(0.0001, c.scale))
      if (c && c.opacity < 1) ctx.globalAlpha *= c.opacity
      if (mode === 'fill') ctx.fillText(g.ch, 0, 0)
      else ctx.strokeText(g.ch, 0, 0)
      ctx.restore()
    }
  }
  const box: Box = { x: -L.width / 2, y: -L.height / 2, w: L.width, h: L.height }
  const paint = makePaint(ctx, el.fill, box)
  let shadowPending = el.shadow.enabled
  const takeShadow = () => { if (shadowPending) { setShadow(ctx, el, px); shadowPending = false; return true } return false }
  const sw = el.stroke.enabled ? el.stroke.width : 0

  // 3D extrusion
  if (el.extrude.enabled && el.extrude.depth > 0) {
    const a = el.extrude.angle * RAD
    const depth = el.extrude.depth
    const steps = Math.min(80, Math.max(1, Math.ceil(depth)))
    for (let k = steps; k >= 1; k--) {
      const d = (k / steps) * depth
      const color = shade(el.extrude.color, -0.12 * (k / steps))
      const had = takeShadow()
      ctx.fillStyle = color
      ctx.strokeStyle = color
      if (sw || el.outline2.enabled) { ctx.lineWidth = sw * 2 + (el.outline2.enabled ? el.outline2.width * 2 : 0); glyphs('stroke', Math.cos(a) * d, Math.sin(a) * d) }
      glyphs('fill', Math.cos(a) * d, Math.sin(a) * d)
      if (had) clearShadow(ctx)
    }
  }
  // glow / neon
  if (el.glow.enabled) {
    ctx.save()
    ctx.shadowColor = el.glow.color
    ctx.shadowBlur = el.glow.blur * px
    const viaStroke = !paint && sw > 0
    ctx.fillStyle = paint ?? el.glow.color
    ctx.strokeStyle = el.stroke.color
    ctx.lineWidth = Math.max(1, sw * 2)
    for (let i = 0; i < Math.max(1, el.glow.strength); i++) glyphs(viaStroke ? 'stroke' : 'fill')
    ctx.restore()
  }
  // chromatic split
  const split = el.rgbSplit + st.rgbSplit
  if (split > 0.1) {
    ctx.save()
    const had = takeShadow()
    ctx.globalAlpha *= 0.9
    ctx.fillStyle = '#ff2bd6'; glyphs('fill', -split, 0)
    if (had) clearShadow(ctx)
    ctx.fillStyle = '#00e5ff'; glyphs('fill', split, 0)
    ctx.restore()
  }
  if (el.outline2.enabled) {
    const had = takeShadow()
    ctx.lineWidth = sw * 2 + el.outline2.width * 2
    ctx.strokeStyle = el.outline2.color
    glyphs('stroke')
    if (had) clearShadow(ctx)
  }
  if (sw > 0) {
    const had = takeShadow()
    ctx.lineWidth = paint ? sw * 2 : sw
    ctx.strokeStyle = el.stroke.color
    if (el.stroke.dash) ctx.setLineDash([el.stroke.dash, el.stroke.dash * 0.7])
    glyphs('stroke')
    ctx.setLineDash([])
    if (had) clearShadow(ctx)
  }
  if (paint) {
    takeShadow()
    ctx.fillStyle = paint
    glyphs('fill')
    clearShadow(ctx)
  }
}
