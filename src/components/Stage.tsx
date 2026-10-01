import { useEffect, useRef, useState } from 'react'
import { useStore, actions, getState, resolved, setAnimated } from '../store'
import { renderScene, drawElement, staticEval } from '../core/render'
import { aabb, corners, hitTest, rectsIntersect, snapRect, toLocal, unionRects, smoothPoints, type Pt, type Rect } from '../core/geometry'
import { createPath, createShape, createText, solid } from '../core/elements'
import type { DesignElement, PathElement, TextElement } from '../core/types'
import { onFontLoaded, ensureFont } from '../core/fonts'
import { onImageLoaded } from '../core/images'
import { bumpTextVersion, fontString } from '../core/text'
import { primaryColor } from '../core/paint'

type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'rot'
const HANDLE_SIGNS: Record<Exclude<Handle, 'rot'>, [number, number]> = { nw: [-1, -1], n: [0, -1], ne: [1, -1], e: [1, 0], se: [1, 1], s: [0, 1], sw: [-1, 1], w: [-1, 0] }
const CURSORS: Record<string, string> = { nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize', rot: 'grab' }

type Orig = { id: string; x: number; y: number; w: number; h: number; rot: number; fs?: number; scale: number }
type Drag =
  | { kind: 'pan'; sx: number; sy: number; px: number; py: number }
  | { kind: 'move'; start: Pt; orig: Orig[]; moved: boolean }
  | { kind: 'resize'; handle: Exclude<Handle, 'rot'>; orig: Orig[]; box: Rect; single: boolean }
  | { kind: 'rotate'; center: Pt; startAngle: number; orig: Orig[] }
  | { kind: 'marquee'; start: Pt; cur: Pt; additive: boolean; base: string[] }
  | { kind: 'draw'; points: Pt[] }
  | { kind: 'create'; start: Pt; cur: Pt }
  | { kind: 'pinch' }

const SHAPE_TOOLS = ['rect', 'ellipse', 'polygon', 'star', 'line', 'arrow'] as const

export function Stage() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drag = useRef<Drag | null>(null)
  const hover = useRef<string | null>(null)
  const pointer = useRef<Pt | null>(null)
  const pen = useRef<Pt[]>([])
  const space = useRef({ held: false, used: false })
  const pointers = useRef(new Map<number, Pt>())
  const pinch = useRef<{ dist: number; mid: Pt } | null>(null)
  const frame = useRef(0)
  const [, force] = useState(0)
  const tool = useStore((s) => s.tool)

  const schedule = () => {
    if (frame.current) return
    frame.current = requestAnimationFrame(() => { frame.current = 0; draw() })
  }

  const toWorld = (sx: number, sy: number): Pt => { const s = getState(); return { x: (sx - s.panX) / s.zoom, y: (sy - s.panY) / s.zoom } }
  const toScreen = (p: Pt): Pt => { const s = getState(); return { x: p.x * s.zoom + s.panX, y: p.y * s.zoom + s.panY } }

  const selectedResolved = () => {
    const s = getState()
    return s.project.elements.filter((e) => s.selection.includes(e.id)).map((e) => resolved(e, s.time))
  }

  /** overall selection frame: rotated box for single element, AABB for multi */
  const selectionFrame = (): { pts: Pt[]; single: DesignElement | null; box: Rect } | null => {
    const els = selectedResolved()
    if (!els.length) return null
    if (els.length === 1) return { pts: corners(els[0]), single: els[0], box: aabb(els[0]) }
    const r = unionRects(els.map(aabb))!
    return { pts: [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }, { x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h }], single: null, box: r }
  }

  const handlePositions = (): { h: Handle; p: Pt }[] => {
    const f = selectionFrame()
    if (!f) return []
    if (f.single?.locked) return []
    const sp = f.pts.map(toScreen)
    const mid = (a: Pt, b: Pt) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
    const list: { h: Handle; p: Pt }[] = [
      { h: 'nw', p: sp[0] }, { h: 'ne', p: sp[1] }, { h: 'se', p: sp[2] }, { h: 'sw', p: sp[3] },
    ]
    const isLine = f.single && (f.single.type === 'line' || f.single.type === 'arrow')
    if (f.single) {
      list.push({ h: 'n', p: mid(sp[0], sp[1]) }, { h: 'e', p: mid(sp[1], sp[2]) }, { h: 's', p: mid(sp[2], sp[3]) }, { h: 'w', p: mid(sp[3], sp[0]) })
      const top = mid(sp[0], sp[1]), c = mid(sp[0], sp[2])
      const dx = top.x - c.x, dy = top.y - c.y, len = Math.hypot(dx, dy) || 1
      list.push({ h: 'rot', p: { x: top.x + (dx / len) * 26, y: top.y + (dy / len) * 26 } })
      if (isLine) return list.filter((l) => l.h === 'e' || l.h === 'w' || l.h === 'rot')
    }
    return list
  }

  function draw() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const s = getState()
    const dpr = window.devicePixelRatio || 1
    const { width: W, height: H } = s.project.artboard
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const css = getComputedStyle(document.documentElement)
    ctx.fillStyle = css.getPropertyValue('--canvas-bg') || '#08080c'
    ctx.fillRect(0, 0, s.viewport.w, s.viewport.h)
    // dot grid
    const gap = 22
    ctx.fillStyle = css.getPropertyValue('--canvas-dot') || 'rgba(255,255,255,.05)'
    const ox = ((s.panX % gap) + gap) % gap, oy = ((s.panY % gap) + gap) % gap
    for (let x = ox; x < s.viewport.w; x += gap) for (let y = oy; y < s.viewport.h; y += gap) ctx.fillRect(x, y, 1.2, 1.2)
    // artboard shadow + checker
    const a0 = toScreen({ x: 0, y: 0 })
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 12
    ctx.fillStyle = '#808080'
    ctx.fillRect(a0.x + 2, a0.y + 2, W * s.zoom - 4, H * s.zoom - 4)
    ctx.restore()
    ctx.save()
    ctx.beginPath(); ctx.rect(a0.x + 1, a0.y + 1, W * s.zoom - 2, H * s.zoom - 2); ctx.clip()
    ctx.fillStyle = '#ffffff'; ctx.fillRect(a0.x, a0.y, W * s.zoom, H * s.zoom)
    const cs = 10
    ctx.fillStyle = '#e4e4ea'
    for (let x = 0; x < W * s.zoom; x += cs) for (let y = (Math.floor(x / cs) % 2) * cs; y < H * s.zoom; y += cs * 2) ctx.fillRect(a0.x + x, a0.y + y, cs, cs)
    ctx.restore()

    ctx.setTransform(dpr * s.zoom, 0, 0, dpr * s.zoom, dpr * s.panX, dpr * s.panY)
    const hidden = s.editingTextId ? new Set([s.editingTextId]) : undefined
    renderScene(ctx, s.project, { time: s.time, animate: !s.designView, hiddenIds: hidden })

    // live brush stroke
    const d = drag.current
    if (d?.kind === 'draw' && d.points.length) {
      const b = s.brush
      const eraser = s.tool === 'eraser'
      const temp = buildPath(d.points, eraser, false)
      if (temp) {
        ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip()
        if (eraser) { temp.brush = 'pen'; temp.stroke = { ...temp.stroke, color: 'rgba(255,255,255,0.55)' } }
        drawElement(ctx, temp, staticEval(temp, s.time))
        ctx.restore()
      }
      void b
    }

    // —— screen-space overlays ——
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const accent = css.getPropertyValue('--accent').trim() || '#8b6cff'
    // artboard label
    ctx.font = '600 11px Inter, sans-serif'
    ctx.fillStyle = css.getPropertyValue('--muted') || '#888'
    ctx.textBaseline = 'bottom'
    ctx.fillText(`${s.project.name} — ${W} × ${H}`, a0.x, a0.y - 8)

    const poly = (pts: Pt[], close = true) => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); if (close) ctx.closePath() }
    // hover
    if (hover.current && !s.selection.includes(hover.current) && !d) {
      const el = s.project.elements.find((e) => e.id === hover.current)
      if (el) { ctx.strokeStyle = accent; ctx.lineWidth = 1.5; poly(corners(resolved(el, s.time)).map(toScreen)); ctx.stroke() }
    }
    // selection
    const sel = selectedResolved()
    if (sel.length && !s.editingTextId && !(d?.kind === 'draw')) {
      ctx.lineWidth = 1
      ctx.strokeStyle = accent
      if (sel.length > 1) for (const el of sel) { ctx.globalAlpha = 0.6; poly(corners(el).map(toScreen)); ctx.stroke(); ctx.globalAlpha = 1 }
      const f = selectionFrame()!
      ctx.lineWidth = 1.5
      poly(f.pts.map(toScreen)); ctx.stroke()
      if (!s.playing) for (const h of handlePositions()) {
        if (h.h === 'rot') {
          const top = toScreen({ x: (f.pts[0].x + f.pts[1].x) / 2, y: (f.pts[0].y + f.pts[1].y) / 2 })
          ctx.beginPath(); ctx.moveTo(top.x, top.y); ctx.lineTo(h.p.x, h.p.y); ctx.stroke()
          ctx.beginPath(); ctx.arc(h.p.x, h.p.y, 5.5, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill(); ctx.stroke()
        } else {
          ctx.fillStyle = '#fff'
          ctx.beginPath(); ctx.roundRect(h.p.x - 4.5, h.p.y - 4.5, 9, 9, 2); ctx.fill(); ctx.stroke()
        }
      }
      if (f.single?.locked) { const p = toScreen(f.pts[1]); ctx.fillStyle = accent; ctx.font = '600 10px Inter'; ctx.fillText('🔒', p.x + 4, p.y) }
      // size pill during transforms
      if (d && (d.kind === 'resize' || d.kind === 'move' || d.kind === 'rotate')) {
        const label = d.kind === 'rotate' && f.single ? `${Math.round(((f.single.rotation % 360) + 360) % 360)}°` : d.kind === 'move' ? `${Math.round(f.box.x)}, ${Math.round(f.box.y)}` : `${Math.round(f.single?.width ?? f.box.w)} × ${Math.round(f.single?.height ?? f.box.h)}`
        const bottom = toScreen({ x: f.box.x + f.box.w / 2, y: f.box.y + f.box.h })
        ctx.font = '600 11px Inter'
        const tw = ctx.measureText(label).width + 14
        ctx.fillStyle = accent
        ctx.beginPath(); ctx.roundRect(bottom.x - tw / 2, bottom.y + 10, tw, 20, 6); ctx.fill()
        ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center'
        ctx.fillText(label, bottom.x, bottom.y + 20)
        ctx.textAlign = 'left'
      }
    }
    // guides
    if (s.guides.length) {
      ctx.strokeStyle = '#ff3d9a'; ctx.lineWidth = 1; ctx.setLineDash([4, 3])
      for (const g of s.guides) {
        ctx.beginPath()
        if (g.axis === 'x') { const p = toScreen({ x: g.pos, y: 0 }); ctx.moveTo(p.x, 0); ctx.lineTo(p.x, s.viewport.h) }
        else { const p = toScreen({ x: 0, y: g.pos }); ctx.moveTo(0, p.y); ctx.lineTo(s.viewport.w, p.y) }
        ctx.stroke()
      }
      ctx.setLineDash([])
    }
    // marquee / creation box
    if (d?.kind === 'marquee' || d?.kind === 'create') {
      const a = toScreen(d.start), b = toScreen(d.cur)
      ctx.fillStyle = 'rgba(139,108,255,0.10)'; ctx.strokeStyle = accent; ctx.lineWidth = 1
      if (d.kind === 'create' && (s.tool === 'line' || s.tool === 'arrow')) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke() }
      else { ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y); ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y) }
    }
    // pen path
    if (s.tool === 'pen' && pen.current.length) {
      const pts = pen.current.map(toScreen)
      ctx.strokeStyle = accent; ctx.lineWidth = 1.5
      poly(pointer.current ? [...pts, pointer.current] : pts, false); ctx.stroke()
      for (const [i, p] of pts.entries()) { ctx.beginPath(); ctx.arc(p.x, p.y, i === 0 ? 6 : 4, 0, Math.PI * 2); ctx.fillStyle = i === 0 ? accent : '#fff'; ctx.fill(); ctx.stroke() }
    }
    // brush cursor
    if ((s.tool === 'brush' || s.tool === 'eraser') && pointer.current) {
      const r = ((s.tool === 'eraser' ? s.brush.eraserSize : s.brush.size) * s.zoom) / 2
      ctx.beginPath(); ctx.arc(pointer.current.x, pointer.current.y, Math.max(2, r), 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.5; ctx.stroke()
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.75; ctx.stroke()
    }
  }

  function buildPath(points: Pt[], eraser: boolean, final: boolean): PathElement | null {
    const s = getState()
    const b = s.brush
    const pts = final ? smoothPoints(points, b.smoothing) : points
    if (!pts.length) return null
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y)
    const minX = Math.min(...xs), minY = Math.min(...ys)
    const w = Math.max(1, Math.max(...xs) - minX), h = Math.max(1, Math.max(...ys) - minY)
    const size = eraser ? b.eraserSize : b.type === 'pencil' ? Math.max(1, b.size * 0.4) : b.type === 'highlighter' ? b.size * 1.6 : b.size
    return createPath({
      x: minX + w / 2, y: minY + h / 2, width: w, height: h, baseW: w, baseH: h,
      points: pts.map((p) => ({ x: p.x - minX, y: p.y - minY })),
      brush: eraser ? 'eraser' : b.type,
      stroke: { enabled: true, color: b.color, width: size },
      opacity: eraser ? 1 : b.type === 'highlighter' ? Math.min(b.opacity, 0.5) : b.opacity,
      name: eraser ? 'Eraser' : b.type[0].toUpperCase() + b.type.slice(1) + ' stroke',
    }, s.project.duration)
  }

  function finishPen(closed: boolean) {
    const pts = pen.current
    pen.current = []
    if (pts.length < 2) { schedule(); return }
    const s = getState()
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y)
    const minX = Math.min(...xs), minY = Math.min(...ys)
    const w = Math.max(1, Math.max(...xs) - minX), h = Math.max(1, Math.max(...ys) - minY)
    const el = createPath({
      x: minX + w / 2, y: minY + h / 2, width: w, height: h, baseW: w, baseH: h,
      points: pts.map((p) => ({ x: p.x - minX, y: p.y - minY })), brush: 'pen', closed, smooth: penSmooth(),
      stroke: { enabled: true, color: s.brush.color, width: Math.max(2, s.brush.size / 2) },
      fill: closed ? solid(s.brush.color + '55') : { type: 'none' }, name: closed ? 'Pen shape' : 'Pen path',
    }, s.project.duration)
    actions.addElements([el])
  }

  const hitElement = (p: Pt): DesignElement | null => {
    const s = getState()
    const tol = 4 / s.zoom
    for (let i = s.project.elements.length - 1; i >= 0; i--) {
      const el = s.project.elements[i]
      if (!el.visible || el.locked) continue
      if (el.type === 'path' && el.brush === 'eraser') continue
      if (hitTest(resolved(el, s.time), p, tol)) return el
    }
    return null
  }

  const hitHandle = (sx: number, sy: number): Handle | null => {
    for (const h of handlePositions()) if (Math.hypot(h.p.x - sx, h.p.y - sy) <= 8) return h.h
    return null
  }

  const origOf = (els: DesignElement[]): Orig[] => {
    const t = getState().time
    return els.map((e) => {
      const r = resolved(e, t)
      return { id: e.id, x: r.x, y: r.y, w: r.width, h: r.height, rot: r.rotation, fs: e.type === 'text' ? e.fontSize : undefined, scale: e.width ? r.width / e.width : 1 }
    })
  }

  // ——— pointer handlers ———
  const local = (e: { clientX: number; clientY: number }) => {
    const r = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  function onPointerDown(e: React.PointerEvent) {
    const canvas = canvasRef.current!
    canvas.setPointerCapture(e.pointerId)
    const sp = local(e)
    pointers.current.set(e.pointerId, sp)
    if (pointers.current.size === 2) {
      // start pinch
      if (drag.current && drag.current.kind !== 'pan') actions.end()
      const [a, b] = [...pointers.current.values()]
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } }
      drag.current = { kind: 'pinch' }
      return
    }
    const s = getState()
    if (s.editingTextId) { actions.select(s.selection) }
    const wp = toWorld(sp.x, sp.y)
    if (e.button === 1 || s.tool === 'hand' || space.current.held) {
      space.current.used = true
      drag.current = { kind: 'pan', sx: sp.x, sy: sp.y, px: s.panX, py: s.panY }
      return
    }
    if (e.button !== 0) return
    if (s.playing) actions.pause()

    if (s.tool === 'brush' || s.tool === 'eraser') {
      drag.current = { kind: 'draw', points: [wp] }
      schedule(); return
    }
    if (s.tool === 'pen') {
      const first = pen.current[0]
      if (first && pen.current.length > 2 && Math.hypot((first.x - wp.x) * s.zoom, (first.y - wp.y) * s.zoom) < 10) { finishPen(true); return }
      pen.current.push(wp)
      if (e.detail >= 2) finishPen(false)
      schedule(); return
    }
    if (s.tool === 'text') {
      const el = createText({ x: wp.x, y: wp.y, text: 'Double-click to edit', fontSize: Math.round(Math.max(24, s.project.artboard.width / 14)), fontFamily: 'Inter', name: 'Text' }, s.project.duration)
      actions.addElements([el])
      useStore.setState({ tool: 'select', editingTextId: el.id })
      return
    }
    if ((SHAPE_TOOLS as readonly string[]).includes(s.tool)) {
      drag.current = { kind: 'create', start: wp, cur: wp }
      return
    }
    // select tool
    const h = hitHandle(sp.x, sp.y)
    if (h) {
      const els = s.project.elements.filter((x) => s.selection.includes(x.id))
      const orig = origOf(els)
      actions.begin()
      if (h === 'rot') {
        const f = selectionFrame()!
        const c = { x: f.box.x + f.box.w / 2, y: f.box.y + f.box.h / 2 }
        const center = f.single ? { x: f.single.x, y: f.single.y } : c
        drag.current = { kind: 'rotate', center, startAngle: Math.atan2(wp.y - center.y, wp.x - center.x), orig }
      } else drag.current = { kind: 'resize', handle: h, orig, box: selectionFrame()!.box, single: els.length === 1 }
      return
    }
    const hit = hitElement(wp)
    if (hit) {
      if (e.shiftKey) actions.select([hit.id], 'toggle')
      else if (!s.selection.includes(hit.id)) actions.select([hit.id])
      const st = getState()
      if (e.detail >= 2 && hit.type === 'text') { useStore.setState({ editingTextId: hit.id, selection: [hit.id] }); return }
      const els = st.project.elements.filter((x) => st.selection.includes(x.id) && !x.locked)
      actions.begin()
      drag.current = { kind: 'move', start: wp, orig: origOf(els), moved: false }
      return
    }
    drag.current = { kind: 'marquee', start: wp, cur: wp, additive: e.shiftKey, base: e.shiftKey ? s.selection : [] }
    if (!e.shiftKey) actions.select([])
  }

  function onPointerMove(e: React.PointerEvent) {
    const sp = local(e)
    pointer.current = sp
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, sp)
    const s = getState()
    const d = drag.current
    const canvas = canvasRef.current!
    if (d?.kind === 'pinch' && pinch.current && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      actions.zoomAt(s.zoom * (dist / pinch.current.dist), mid.x, mid.y)
      const st = getState()
      useStore.setState({ panX: st.panX + mid.x - pinch.current.mid.x, panY: st.panY + mid.y - pinch.current.mid.y })
      pinch.current = { dist, mid }
      return
    }
    const wp = toWorld(sp.x, sp.y)
    if (!d) {
      // hover + cursor
      let cursor = 'default'
      if (s.tool === 'hand' || space.current.held) cursor = 'grab'
      else if (s.tool === 'brush' || s.tool === 'eraser') cursor = 'none'
      else if (s.tool !== 'select') cursor = 'crosshair'
      else {
        const h = hitHandle(sp.x, sp.y)
        if (h) cursor = CURSORS[h]
        const hit = h ? null : hitElement(wp)
        if (hit) cursor = 'move'
        if ((hit?.id ?? null) !== hover.current) { hover.current = hit?.id ?? null }
      }
      canvas.style.cursor = cursor
      schedule()
      return
    }
    switch (d.kind) {
      case 'pan':
        useStore.setState({ panX: d.px + sp.x - d.sx, panY: d.py + sp.y - d.sy })
        canvas.style.cursor = 'grabbing'
        break
      case 'draw':
        {
          const last = d.points[d.points.length - 1]
          if (Math.hypot(last.x - wp.x, last.y - wp.y) * s.zoom > 1.2) d.points.push(wp)
          schedule()
        }
        break
      case 'create':
      case 'marquee':
        d.cur = wp
        if (d.kind === 'marquee') {
          const r = { x: Math.min(d.start.x, wp.x), y: Math.min(d.start.y, wp.y), w: Math.abs(wp.x - d.start.x), h: Math.abs(wp.y - d.start.y) }
          const ids = s.project.elements.filter((el) => el.visible && !el.locked && rectsIntersect(r, aabb(resolved(el, s.time)))).map((el) => el.id)
          actions.select([...new Set([...d.base, ...ids])])
        }
        schedule()
        break
      case 'move': {
        let dx = wp.x - d.start.x, dy = wp.y - d.start.y
        if (!d.moved && Math.hypot(dx, dy) * s.zoom < 3) return
        d.moved = true
        if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0 }
        let guides: { axis: 'x' | 'y'; pos: number }[] = []
        if (s.snapping && !e.altKey) {
          const ids = new Set(d.orig.map((o) => o.id))
          const boxes = d.orig.map((o) => aabb({ x: o.x + dx, y: o.y + dy, width: o.w, height: o.h, rotation: o.rot }))
          const u = unionRects(boxes)!
          const { width: W, height: H } = s.project.artboard
          const xs = [0, W / 2, W], ys = [0, H / 2, H]
          for (const el of s.project.elements) {
            if (ids.has(el.id) || !el.visible) continue
            const r = aabb(resolved(el, s.time))
            xs.push(r.x, r.x + r.w / 2, r.x + r.w); ys.push(r.y, r.y + r.h / 2, r.y + r.h)
          }
          const snap = snapRect(u, xs, ys, 6 / s.zoom)
          dx += snap.dx; dy += snap.dy; guides = snap.guides
        }
        const byId = new Map(d.orig.map((o) => [o.id, o]))
        actions.live((p) => {
          for (const el of p.elements) {
            const o = byId.get(el.id)
            if (!o) continue
            setAnimated(el, 'x', o.x + dx, s.time, s.designView)
            setAnimated(el, 'y', o.y + dy, s.time, s.designView)
          }
        })
        useStore.setState({ guides })
        break
      }
      case 'resize': {
        const byId = new Map(d.orig.map((o) => [o.id, o]))
        const [hx, hy] = HANDLE_SIGNS[d.handle]
        if (d.single) {
          const o = d.orig[0]
          const el0 = s.project.elements.find((x) => x.id === o.id)!
          const l = toLocal({ x: o.x, y: o.y, rotation: o.rot }, wp)
          const ax = (-hx * o.w) / 2, ay = (-hy * o.h) / 2
          let nw = hx ? Math.max(4, (l.x - ax) * hx) : o.w
          let nh = hy ? Math.max(4, (l.y - ay) * hy) : o.h
          const uniform = el0.type === 'text' || (e.shiftKey !== (el0.type === 'image' && hx !== 0 && hy !== 0))
          if (uniform) {
            const k = hx && hy ? Math.max(nw / o.w, nh / o.h) : hx ? nw / o.w : nh / o.h
            nw = o.w * k; nh = o.h * k
          }
          const cxl = hx ? ax + (hx * nw) / 2 : 0, cyl = hy ? ay + (hy * nh) / 2 : (uniform ? 0 : 0)
          const r = (o.rot * Math.PI) / 180
          const cx = o.x + cxl * Math.cos(r) - cyl * Math.sin(r)
          const cy = o.y + cxl * Math.sin(r) + cyl * Math.cos(r)
          actions.live((p) => {
            const el = p.elements.find((x) => x.id === o.id)
            if (!el) return
            if (el.type === 'text') (el as TextElement).fontSize = Math.max(4, (o.fs ?? 40) * (nw / o.w))
            else { el.width = nw / o.scale; el.height = (el.type === 'line' || el.type === 'arrow') ? el.height : nh / o.scale }
            setAnimated(el, 'x', cx, s.time, s.designView)
            setAnimated(el, 'y', cy, s.time, s.designView)
          })
        } else {
          const b = d.box
          const anchor = { x: hx > 0 ? b.x : b.x + b.w, y: hy > 0 ? b.y : b.y + b.h }
          const kx = Math.abs(wp.x - anchor.x) / b.w, ky = Math.abs(wp.y - anchor.y) / b.h
          const k = Math.max(0.05, Math.max(kx, ky))
          actions.live((p) => {
            for (const el of p.elements) {
              const o = byId.get(el.id)
              if (!o) continue
              if (el.type === 'text') (el as TextElement).fontSize = Math.max(4, (o.fs ?? 40) * k)
              else { el.width = (o.w * k) / o.scale; el.height = (el.type === 'line' || el.type === 'arrow') ? el.height : (o.h * k) / o.scale }
              setAnimated(el, 'x', anchor.x + (o.x - anchor.x) * k, s.time, s.designView)
              setAnimated(el, 'y', anchor.y + (o.y - anchor.y) * k, s.time, s.designView)
            }
          })
        }
        break
      }
      case 'rotate': {
        const ang = Math.atan2(wp.y - d.center.y, wp.x - d.center.x)
        let delta = ((ang - d.startAngle) * 180) / Math.PI
        const byId = new Map(d.orig.map((o) => [o.id, o]))
        actions.live((p) => {
          for (const el of p.elements) {
            const o = byId.get(el.id)
            if (!o) continue
            let r = o.rot + delta
            if (e.shiftKey) { r = Math.round(r / 15) * 15; delta = r - o.rot }
            setAnimated(el, 'rotation', Math.round(r * 10) / 10, s.time, s.designView)
          }
        })
        break
      }
    }
    schedule()
  }

  function onPointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId)
    const d = drag.current
    if (d?.kind === 'pinch') { if (pointers.current.size === 0) { drag.current = null; pinch.current = null } return }
    drag.current = null
    const s = getState()
    if (!d) return
    switch (d.kind) {
      case 'move': case 'resize': case 'rotate': actions.end(); break
      case 'draw': {
        const el = buildPath(d.points, s.tool === 'eraser', true)
        if (el) actions.addElements([el], false)
        break
      }
      case 'create': {
        const t = s.tool as (typeof SHAPE_TOOLS)[number]
        const dx = d.cur.x - d.start.x, dy = d.cur.y - d.start.y
        const tiny = Math.hypot(dx, dy) * s.zoom < 4
        const dflt = Math.max(80, Math.min(s.project.artboard.width, s.project.artboard.height) / 4)
        let el
        const fillColor = s.brush.color
        if (t === 'line' || t === 'arrow') {
          const len = tiny ? dflt * 1.5 : Math.hypot(dx, dy)
          el = createShape(t, { x: tiny ? d.start.x : (d.start.x + d.cur.x) / 2, y: tiny ? d.start.y : (d.start.y + d.cur.y) / 2, width: len, rotation: tiny ? 0 : (Math.atan2(dy, dx) * 180) / Math.PI, stroke: { enabled: true, color: fillColor, width: Math.max(4, Math.round(dflt / 30)) } }, s.project.duration)
        } else {
          let w = tiny ? dflt : Math.abs(dx), h = tiny ? dflt : Math.abs(dy)
          if (e.shiftKey || t === 'star' || t === 'polygon') { if (!tiny && (e.shiftKey)) { const m = Math.max(w, h); w = m; h = m } }
          const cx = tiny ? d.start.x : Math.min(d.start.x, d.cur.x) + w / 2
          const cy = tiny ? d.start.y : Math.min(d.start.y, d.cur.y) + h / 2
          el = createShape(t, { x: cx, y: cy, width: w, height: h, fill: solid(fillColor) }, s.project.duration)
        }
        actions.addElements([el])
        useStore.setState({ tool: 'select' })
        break
      }
      case 'pan': space.current.used = true; break
    }
    schedule()
  }

  // resize observer
  useEffect(() => {
    const wrap = wrapRef.current!, canvas = canvasRef.current!
    let first = true
    const ro = new ResizeObserver(() => {
      const r = wrap.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr)
      canvas.style.width = r.width + 'px'; canvas.style.height = r.height + 'px'
      useStore.setState({ viewport: { w: r.width, h: r.height } })
      if (first) { actions.fitView(); first = false }
      draw()
    })
    ro.observe(wrap)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // redraw on any store change
  useEffect(() => {
    const unsub = useStore.subscribe(() => schedule())
    const u1 = onFontLoaded(() => { bumpTextVersion(); actions.resyncText(); schedule() })
    const u2 = onImageLoaded(() => schedule())
    return () => { unsub(); u1(); u2() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ensure fonts used by the project are requested
  const project = useStore((s) => s.project)
  useEffect(() => {
    for (const el of project.elements) if (el.type === 'text') ensureFont(el.fontFamily, el.fontWeight, el.italic)
  }, [project])

  // wheel zoom / pan (non-passive)
  useEffect(() => {
    const canvas = canvasRef.current!
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const s = getState()
      const sp = local(e)
      if (e.ctrlKey || e.metaKey) actions.zoomAt(s.zoom * Math.exp(-e.deltaY * 0.0105), sp.x, sp.y)
      else useStore.setState({ panX: s.panX - e.deltaX, panY: s.panY - e.deltaY })
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [])

  // space (hold = pan, tap = play) + pen keys
  useEffect(() => {
    const isTyping = (e: KeyboardEvent) => { const t = e.target as HTMLElement; return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable) }
    const down = (e: KeyboardEvent) => {
      if (isTyping(e)) return
      if (e.code === 'Space') { e.preventDefault(); if (!space.current.held) { space.current = { held: true, used: false } } }
      if (getState().tool === 'pen' && pen.current.length) {
        if (e.key === 'Enter') { e.preventDefault(); finishPen(false) }
        if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); finishPen(false) }
      }
    }
    const up = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      if (isTyping(e)) { space.current.held = false; return }
      const used = space.current.used
      space.current = { held: false, used: false }
      if (!used) actions.togglePlay()
    }
    window.addEventListener('keydown', down, true)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down, true); window.removeEventListener('keyup', up) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // abandon pen path on tool switch
  useEffect(() => { if (tool !== 'pen' && pen.current.length) { finishPen(false) } schedule() // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool])

  const editing = useStore((s) => (s.editingTextId ? s.project.elements.find((e) => e.id === s.editingTextId) as TextElement | undefined : undefined))
  const zoom = useStore((s) => s.zoom), panX = useStore((s) => s.panX), panY = useStore((s) => s.panY), time = useStore((s) => s.time)

  return (
    <div ref={wrapRef} className="relative flex-1 min-w-0 min-h-0 overflow-hidden" onContextMenu={(e) => e.preventDefault()}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 touch-none select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => { pointer.current = null; hover.current = null; schedule() }}
        onDoubleClick={(e) => {
          if (getState().tool !== 'select') return
          const sp = local(e)
          const hit = hitElement(toWorld(sp.x, sp.y))
          if (hit?.type === 'text') useStore.setState({ editingTextId: hit.id, selection: [hit.id] })
        }}
      />
      {editing && <TextEditor key={editing.id} el={resolved(editing, time) as TextElement} zoom={zoom} panX={panX} panY={panY} onDone={() => { force((x) => x + 1) }} />}
    </div>
  )
}

function penSmooth() { return getState().brush.smoothing > 0.05 }

function TextEditor({ el, zoom, panX, panY, onDone }: { el: TextElement; zoom: number; panX: number; panY: number; onDone: () => void }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => { const t = ref.current!; t.focus(); t.select() }, [])
  const finish = () => {
    const s = getState()
    const cur = s.project.elements.find((e) => e.id === el.id) as TextElement | undefined
    if (cur && !cur.text.trim()) { actions.deleteSelection() }
    useStore.setState({ editingTextId: null })
    onDone()
  }
  const w = Math.max(el.width, el.fontSize * 2) * zoom + 24
  const h = el.height * zoom + 16
  const color = el.fill.type === 'none' ? el.stroke.color : primaryColor(el.fill)
  return (
    <textarea
      ref={ref}
      defaultValue={el.text}
      spellCheck={false}
      onChange={(e) => actions.updateEl(el.id, (d) => { (d as TextElement).text = e.target.value }, 'text-edit')}
      onBlur={finish}
      onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape' || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) (e.target as HTMLTextAreaElement).blur() }}
      className="absolute resize-none outline-none rounded-md overflow-hidden"
      style={{
        left: el.x * zoom + panX - w / 2, top: el.y * zoom + panY - h / 2, width: w, height: h,
        transform: `rotate(${el.rotation}deg)`,
        font: fontString(el, el.fontSize * zoom), lineHeight: el.lineHeight, letterSpacing: el.letterSpacing * zoom,
        textAlign: el.align, color, textTransform: el.transform === 'none' ? undefined : el.transform,
        background: 'rgba(124,92,255,0.12)', border: '1.5px dashed var(--accent)', padding: '6px 10px',
        caretColor: 'var(--accent-2)',
      }}
    />
  )
}
