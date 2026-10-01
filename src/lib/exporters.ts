import type { DesignElement, Fill, Project, TextElement, PathElement, ShapeElement, ImageElement } from '../core/types'
import { renderScene } from '../core/render'
import { layoutText, fontString } from '../core/text'
import { GIFEncoder, quantize, applyPalette } from 'gifenc'
import { primaryColor } from '../core/paint'
import { interpolate } from '../core/keyframes'
import { FONTS } from '../core/fonts'
import fixWebmDuration from 'fix-webm-duration'

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export function safeName(name: string) {
  return (name || 'design').replace(/[^\p{L}\p{N}\-_ ]+/gu, '').trim().replace(/\s+/g, '-').toLowerCase() || 'design'
}

export async function fontsReady() {
  try { await document.fonts.ready } catch { /* ignore */ }
}

export function renderFrame(project: Project, opts: { time: number; animate: boolean; scale: number; background?: boolean; canvas?: HTMLCanvasElement }) {
  const c = opts.canvas ?? document.createElement('canvas')
  const w = Math.max(1, Math.round(project.artboard.width * opts.scale))
  const h = Math.max(1, Math.round(project.artboard.height * opts.scale))
  if (c.width !== w) c.width = w
  if (c.height !== h) c.height = h
  const ctx = c.getContext('2d')!
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, w, h)
  ctx.setTransform(opts.scale, 0, 0, opts.scale, 0, 0)
  renderScene(ctx, project, { time: opts.time, animate: opts.animate, background: opts.background })
  return c
}

export async function exportImage(project: Project, fmt: 'png' | 'jpeg', scale: number, time: number, animate: boolean, transparent = false): Promise<Blob> {
  await fontsReady()
  const c = renderFrame(project, { time, animate, scale, background: !transparent || fmt === 'jpeg' })
  if (fmt === 'jpeg') {
    // flatten on white in case the background is transparent
    const flat = document.createElement('canvas')
    flat.width = c.width; flat.height = c.height
    const f = flat.getContext('2d')!
    f.fillStyle = '#ffffff'; f.fillRect(0, 0, c.width, c.height); f.drawImage(c, 0, 0)
    return new Promise((res, rej) => flat.toBlob((b) => (b ? res(b) : rej(new Error('encode failed'))), 'image/jpeg', 0.92))
  }
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('encode failed'))), 'image/png'))
}

export function thumbnail(project: Project, max = 320): string {
  const s = max / Math.max(project.artboard.width, project.artboard.height)
  try { return renderFrame(project, { time: 0, animate: false, scale: s }).toDataURL('image/jpeg', 0.7) } catch { return '' }
}

// ——— Video ———
export function pickVideoMime(): { mime: string; ext: string } | null {
  if (typeof MediaRecorder === 'undefined') return null
  const opts = [
    { mime: 'video/webm;codecs=vp9', ext: 'webm' },
    { mime: 'video/webm;codecs=vp8', ext: 'webm' },
    { mime: 'video/webm', ext: 'webm' },
    { mime: 'video/mp4;codecs=avc1', ext: 'mp4' },
    { mime: 'video/mp4', ext: 'mp4' },
  ]
  return opts.find((o) => MediaRecorder.isTypeSupported(o.mime)) ?? null
}

export async function recordVideo(project: Project, opts: { scale: number; fps: number; bitrate: number; onProgress?: (p: number) => void; signal?: AbortSignal }): Promise<{ blob: Blob; ext: string }> {
  const kind = pickVideoMime()
  if (!kind) throw new Error('This browser cannot record video (MediaRecorder unsupported).')
  await fontsReady()
  const canvas = document.createElement('canvas')
  renderFrame(project, { time: 0, animate: true, scale: opts.scale, canvas })
  const stream = canvas.captureStream(opts.fps)
  const rec = new MediaRecorder(stream, { mimeType: kind.mime, videoBitsPerSecond: opts.bitrate })
  const chunks: Blob[] = []
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data) }
  const done = new Promise<void>((res) => { rec.onstop = () => res() })
  rec.start(250)
  const dur = project.duration
  await new Promise<void>((resolve) => {
    const t0 = performance.now()
    const step = () => {
      const t = (performance.now() - t0) / 1000
      if (opts.signal?.aborted) { resolve(); return }
      renderFrame(project, { time: Math.min(t, dur), animate: true, scale: opts.scale, canvas })
      opts.onProgress?.(Math.min(1, t / dur))
      if (t >= dur) { setTimeout(resolve, 120); return }
      requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  })
  rec.stop()
  stream.getTracks().forEach((t) => t.stop())
  await done
  if (opts.signal?.aborted) throw new Error('cancelled')
  let blob = new Blob(chunks, { type: kind.mime.split(';')[0] })
  // MediaRecorder WebM files lack a duration header; patch it so players can seek
  if (kind.ext === 'webm') { try { blob = await fixWebmDuration(blob, dur * 1000, { logger: false }) } catch { /* keep original */ } }
  return { blob, ext: kind.ext }
}

export async function exportGif(project: Project, opts: { maxSize: number; fps: number; onProgress?: (p: number) => void; signal?: AbortSignal }): Promise<Blob> {
  await fontsReady()
  const scale = Math.min(1, opts.maxSize / Math.max(project.artboard.width, project.artboard.height))
  const canvas = document.createElement('canvas')
  const frames = Math.max(1, Math.round(project.duration * opts.fps))
  const gif = GIFEncoder()
  const delay = Math.round(1000 / opts.fps)
  for (let i = 0; i < frames; i++) {
    if (opts.signal?.aborted) throw new Error('cancelled')
    renderFrame(project, { time: (i / opts.fps), animate: true, scale, canvas })
    const ctx = canvas.getContext('2d')!
    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const palette = quantize(data, 256)
    const index = applyPalette(data, palette)
    gif.writeFrame(index, width, height, { palette, delay })
    opts.onProgress?.((i + 1) / frames)
    if (i % 3 === 0) await new Promise((r) => setTimeout(r, 0))
  }
  gif.finish()
  return new Blob([gif.bytes() as BlobPart], { type: 'image/gif' })
}

// ——— SVG ———
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const n = (v: number) => (Math.round(v * 100) / 100).toString()

export function exportSVG(project: Project, time: number): string {
  const W = project.artboard.width, H = project.artboard.height
  const defs: string[] = []
  let gid = 0
  const paint = (fill: Fill, box: { x: number; y: number; w: number; h: number }): string => {
    if (fill.type === 'none') return 'none'
    if (fill.type === 'solid') return fill.color
    if (fill.type === 'linear' || fill.type === 'radial') {
      const id = `g${gid++}`
      const stops = fill.stops.map((s) => `<stop offset="${n(s.offset)}" stop-color="${esc(s.color)}"/>`).join('')
      if (fill.type === 'radial') defs.push(`<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${n(box.x + box.w / 2)}" cy="${n(box.y + box.h / 2)}" r="${n(Math.max(box.w, box.h) / 2)}">${stops}</radialGradient>`)
      else {
        const a = ((fill.angle - 90) * Math.PI) / 180
        const cx = box.x + box.w / 2, cy = box.y + box.h / 2
        const len = (Math.abs(box.w * Math.cos(a)) + Math.abs(box.h * Math.sin(a))) / 2
        defs.push(`<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${n(cx - Math.cos(a) * len)}" y1="${n(cy - Math.sin(a) * len)}" x2="${n(cx + Math.cos(a) * len)}" y2="${n(cy + Math.sin(a) * len)}">${stops}</linearGradient>`)
      }
      return `url(#${id})`
    }
    if (fill.src) {
      const id = `p${gid++}`
      defs.push(`<pattern id="${id}" patternUnits="userSpaceOnUse" x="${n(box.x)}" y="${n(box.y)}" width="${n(box.w)}" height="${n(box.h)}"><image href="${esc(fill.src)}" width="${n(box.w)}" height="${n(box.h)}" preserveAspectRatio="xMidYMid slice"/></pattern>`)
      return `url(#${id})`
    }
    return primaryColor(fill)
  }
  const effects = (el: DesignElement): string => {
    const parts: string[] = []
    if (el.glow.enabled) parts.push(`<feDropShadow dx="0" dy="0" stdDeviation="${n(el.glow.blur / 2)}" flood-color="${esc(el.glow.color)}"/>`.repeat(Math.max(1, el.glow.strength)))
    if (el.shadow.enabled) parts.push(`<feDropShadow dx="${n(el.shadow.offsetX)}" dy="${n(el.shadow.offsetY)}" stdDeviation="${n(el.shadow.blur / 2)}" flood-color="${esc(el.shadow.color)}"/>`)
    if (!parts.length) return ''
    const id = `f${gid++}`
    defs.push(`<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%">${parts.join('')}</filter>`)
    return ` filter="url(#${id})"`
  }
  const body: string[] = []
  const bg = paint(project.artboard.background, { x: 0, y: 0, w: W, h: H })
  if (bg !== 'none') body.push(`<rect width="${W}" height="${H}" fill="${bg}"/>`)
  const usedFonts = new Set<string>()
  let skippedEraser = false
  for (const el0 of project.elements) {
    if (!el0.visible) continue
    const kf = el0.anim.keyframes
    const s = interpolate(kf.scale, time, 1)
    const el = { ...el0, x: interpolate(kf.x, time, el0.x), y: interpolate(kf.y, time, el0.y), rotation: interpolate(kf.rotation, time, el0.rotation) } as DesignElement
    const op = el.opacity * interpolate(kf.opacity, time, 1)
    const blend = el.blendMode !== 'source-over' ? ` style="mix-blend-mode:${el.blendMode}"` : ''
    const tr = `translate(${n(el.x)} ${n(el.y)}) rotate(${n(el.rotation)}) scale(${n(s)})`
    const box = { x: -el.width / 2, y: -el.height / 2, w: el.width, h: el.height }
    const strokeAttr = el.stroke.enabled ? ` stroke="${esc(el.stroke.color)}" stroke-width="${n(el.stroke.width)}" stroke-linecap="round" stroke-linejoin="round"${el.stroke.dash ? ` stroke-dasharray="${el.stroke.dash} ${n(el.stroke.dash * 0.8)}"` : ''}` : ''
    let inner = ''
    if (el.type === 'text') {
      const t = el as TextElement
      usedFonts.add(t.fontFamily)
      const L = layoutText(t)
      const g = L.glyphs.filter((x) => x.ch !== ' ')
      const xs = g.map((x) => n(x.x)).join(' '), ys = g.map((x) => n(x.y)).join(' ')
      const rot = g.some((x) => x.rot) ? ` rotate="${g.map((x) => n((x.rot * 180) / Math.PI)).join(' ')}"` : ''
      const content = esc(g.map((x) => x.ch).join(''))
      const font = ` font-family="${esc(t.fontFamily)}, sans-serif" font-size="${t.fontSize}" font-weight="${t.fontWeight}"${t.italic ? ' font-style="italic"' : ''} text-anchor="middle" dominant-baseline="central"`
      const one = (fill: string, extra = '', dx = 0, dy = 0) => `<text x="${g.map((x) => n(x.x + dx)).join(' ')}" y="${g.map((x) => n(x.y + dy)).join(' ')}"${rot}${font} fill="${fill}"${extra}>${content}</text>`
      const layers: string[] = []
      if (t.extrude.enabled) {
        const a = (t.extrude.angle * Math.PI) / 180
        const steps = Math.min(40, Math.ceil(t.extrude.depth))
        for (let k = steps; k >= 1; k--) { const d = (k / steps) * t.extrude.depth; layers.push(one(t.extrude.color, '', Math.cos(a) * d, Math.sin(a) * d)) }
      }
      if (t.outline2.enabled) layers.push(`<text x="${xs}" y="${ys}"${rot}${font} fill="none" stroke="${esc(t.outline2.color)}" stroke-width="${n((t.stroke.enabled ? t.stroke.width * 2 : 0) + t.outline2.width * 2)}" stroke-linejoin="round">${content}</text>`)
      const fill = paint(t.fill, { x: -L.width / 2, y: -L.height / 2, w: L.width, h: L.height })
      const st = t.stroke.enabled ? ` stroke="${esc(t.stroke.color)}" stroke-width="${n(fill === 'none' ? t.stroke.width : t.stroke.width * 2)}" stroke-linejoin="round" paint-order="stroke"` : ''
      layers.push(one(fill, st))
      inner = layers.join('')
    } else if (el.type === 'path') {
      const p = el as PathElement
      if (p.brush === 'eraser') { skippedEraser = true; continue }
      const sx = el.width / (p.baseW || 1), sy = el.height / (p.baseH || 1)
      const P = p.points.map((q) => ({ x: q.x * sx - el.width / 2, y: q.y * sy - el.height / 2 }))
      if (!P.length) continue
      let d = `M${n(P[0].x)} ${n(P[0].y)}`
      if (p.smooth && P.length > 2) {
        for (let i = 1; i < P.length - 1; i++) d += ` Q${n(P[i].x)} ${n(P[i].y)} ${n((P[i].x + P[i + 1].x) / 2)} ${n((P[i].y + P[i + 1].y) / 2)}`
        d += ` L${n(P[P.length - 1].x)} ${n(P[P.length - 1].y)}`
      } else for (let i = 1; i < P.length; i++) d += ` L${n(P[i].x)} ${n(P[i].y)}`
      if (p.closed) d += ' Z'
      const op2 = p.brush === 'highlighter' ? ' style="mix-blend-mode:multiply"' : ''
      inner = `<path d="${d}" fill="${p.closed ? paint(p.fill, box) : 'none'}"${strokeAttr}${op2}/>`
    } else if (el.type === 'image') {
      const im = el as ImageElement
      const f = im.filters
      const css = `brightness(${f.brightness}%) contrast(${f.contrast}%) saturate(${f.saturate}%) grayscale(${f.grayscale}%) sepia(${f.sepia}%) invert(${f.invert}%) hue-rotate(${f.hueRotate}deg)${f.blur ? ` blur(${f.blur}px)` : ''}`
      const cid = `c${gid++}`
      defs.push(`<clipPath id="${cid}"><rect x="${n(box.x)}" y="${n(box.y)}" width="${n(box.w)}" height="${n(box.h)}" rx="${n(im.radius)}"/></clipPath>`)
      inner = `<image href="${esc(im.src)}" x="${n(box.x)}" y="${n(box.y)}" width="${n(box.w)}" height="${n(box.h)}" preserveAspectRatio="none" clip-path="url(#${cid})" style="filter:${css}"/>`
    } else {
      const sh = el as ShapeElement
      const f = paint(sh.fill, box)
      const w = el.width, h = el.height
      if (sh.type === 'rect') inner = `<rect x="${n(-w / 2)}" y="${n(-h / 2)}" width="${n(w)}" height="${n(h)}" rx="${n(Math.min(sh.radius ?? 0, w / 2, h / 2))}" fill="${f}"${strokeAttr}/>`
      else if (sh.type === 'ellipse') inner = `<ellipse rx="${n(w / 2)}" ry="${n(h / 2)}" fill="${f}"${strokeAttr}/>`
      else if (sh.type === 'polygon' || sh.type === 'star') {
        const cnt = Math.max(3, sh.sides ?? 5), pts = sh.type === 'star' ? cnt * 2 : cnt
        const list = Array.from({ length: pts }, (_, i) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / pts; const rr = sh.type === 'star' && i % 2 ? (sh.innerRatio ?? 0.45) : 1; return `${n(Math.cos(a) * (w / 2) * rr)},${n(Math.sin(a) * (h / 2) * rr)}` })
        inner = `<polygon points="${list.join(' ')}" fill="${f}"${strokeAttr}/>`
      } else {
        const head = Math.min(w * 0.4, Math.max(18, sh.stroke.width * 3.2))
        const end = sh.type === 'arrow' ? w / 2 - head * 0.6 : w / 2
        inner = `<line x1="${n(-w / 2)}" y1="0" x2="${n(end)}" y2="0"${strokeAttr}/>`
        if (sh.type === 'arrow') inner += `<polygon points="${n(w / 2)},0 ${n(w / 2 - head)},${n(-head * 0.6)} ${n(w / 2 - head)},${n(head * 0.6)}" fill="${esc(sh.stroke.color)}"/>`
      }
    }
    body.push(`<g transform="${tr}" opacity="${n(op)}"${effects(el)}${blend}>${inner}</g>`)
  }
  const fontImports = [...usedFonts].map((f) => FONTS.find((x) => x.family === f)).filter((f): f is (typeof FONTS)[number] => !!f).map((f) => `family=${f.family.replace(/ /g, '+')}${f.weights.length === 1 && f.weights[0] === 400 ? '' : `:wght@${f.weights.join(';')}`}`)
  const style = fontImports.length ? `<style>@import url('https://fonts.googleapis.com/css2?${fontImports.join('&amp;')}&amp;display=swap');</style>` : ''
  const note = skippedEraser ? '<!-- eraser strokes are raster-only and were omitted -->' : ''
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${note}${style}<defs>${defs.join('')}</defs>${body.join('')}</svg>`
}

export { fontString }
