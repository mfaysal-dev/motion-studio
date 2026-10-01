import { useMemo, useState } from 'react'
import type { Draft } from 'immer'
import { AlignStartVertical, AlignCenterVertical, AlignEndVertical, AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal, AlignHorizontalSpaceAround, AlignVerticalSpaceAround, Play, Diamond, Trash2, Italic, AlignLeft, AlignCenter, AlignRight, Sparkles, RotateCcw } from 'lucide-react'
import { useStore, actions, resolved, setAnimated } from '../store'
import type { BlendMode, DesignElement, ImageElement, PathElement, ShapeElement, TextElement, PresetClip, AnimProp, Keyframe } from '../core/types'
import { Section, Row, Slider, NumberInput, ColorInput, Toggle, Select, Segmented } from './ui'
import { FillEditor } from './FillEditor'
import { FONTS, closestWeight, ensureFont } from '../core/fonts'
import { ARTBOARD_PRESETS } from '../core/elements'
import { presetsOf, makeClip, type PresetKind, KEYFRAME_PROPS } from '../core/animate'
import { EASING_NAMES, getEasing } from '../core/easing'
import { interpolate } from '../core/keyframes'

const BLENDS: BlendMode[] = ['source-over', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity']
const blendLabel = (b: string) => (b === 'source-over' ? 'Normal' : b.replace('-', ' ').replace(/\b\w/g, (m) => m.toUpperCase()))

export function Inspector() {
  const tab = useStore((s) => s.rightTab)
  const selection = useStore((s) => s.selection)
  const elements = useStore((s) => s.project.elements)
  const sel = useMemo(() => elements.filter((e) => selection.includes(e.id)), [elements, selection])
  return (
    <div className="w-[300px] max-xl:w-[276px] shrink-0 bg-panel border-l border-line flex flex-col min-h-0 max-md:hidden">
      <div className="flex gap-1 p-2 border-b border-line">
        <button className={`tab flex-1 ${tab === 'design' ? 'active' : ''}`} onClick={() => useStore.setState({ rightTab: 'design' })}>Design</button>
        <button className={`tab flex-1 flex items-center justify-center gap-1.5 ${tab === 'animate' ? 'active' : ''}`} onClick={() => useStore.setState({ rightTab: 'animate' })}><Sparkles size={13} />Animate</button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {!sel.length ? <ArtboardPanel /> : tab === 'design' ? <DesignPanel els={sel} /> : <AnimatePanel el={sel[0]} count={sel.length} />}
      </div>
    </div>
  )
}

function ArtboardPanel() {
  const project = useStore((s) => s.project)
  const snapping = useStore((s) => s.snapping)
  const preset = ARTBOARD_PRESETS.find((p) => p.w === project.artboard.width && p.h === project.artboard.height)?.id ?? 'custom'
  return (
    <>
      <Section title="Artboard">
        <Row label="Name"><input className="field w-full" value={project.name} onKeyDown={(e) => e.stopPropagation()} onChange={(e) => actions.commit((d) => { d.name = e.target.value }, 'name')} /></Row>
        <Row label="Size">
          <Select className="w-full" value={preset} onChange={(v) => { const p = ARTBOARD_PRESETS.find((x) => x.id === v); if (p) actions.setArtboard(p.w, p.h) }}
            options={[...ARTBOARD_PRESETS.map((p) => ({ value: p.id, label: `${p.name} · ${p.w}×${p.h}` })), { value: 'custom', label: 'Custom' }]} />
        </Row>
        <Row label="W × H">
          <NumberInput label="W" value={project.artboard.width} min={16} max={8000} onChange={(v) => actions.setArtboard(Math.round(v), project.artboard.height)} />
          <NumberInput label="H" value={project.artboard.height} min={16} max={8000} onChange={(v) => actions.setArtboard(project.artboard.width, Math.round(v))} />
        </Row>
        <Row label="Duration"><NumberInput value={project.duration} step={0.5} min={1} max={120} suffix="s" onChange={actions.setDuration} className="w-full" /></Row>
        <Row label="Snapping"><Toggle checked={snapping} onChange={(v) => useStore.setState({ snapping: v })} /></Row>
      </Section>
      <Section title="Background">
        <FillEditor fill={project.artboard.background} onChange={(f, key) => actions.commit((d) => { d.artboard.background = f }, key)} />
      </Section>
      <div className="p-4 text-[12px] text-muted leading-relaxed">
        Select a layer to edit its style, or switch to <b className="text-ink">Animate</b> to add motion. Press <span className="kbd">?</span> for shortcuts.
      </div>
    </>
  )
}

function DesignPanel({ els }: { els: DesignElement[] }) {
  const time = useStore((s) => s.time)
  const designView = useStore((s) => s.designView)
  const el = els[0]
  const r = resolved(el, time)
  const upd = (fn: (d: Draft<DesignElement>) => void, key?: string) => actions.updateSelected(fn, key)
  const texts = els.filter((e) => e.type === 'text') as TextElement[]
  const allText = texts.length === els.length
  const t = texts[0]
  return (
    <>
      <div className="px-3 py-3 border-b border-line">
        <div className="flex items-center justify-between mb-2.5">
          <div className="font-semibold truncate">{els.length > 1 ? `${els.length} layers` : el.name}</div>
          <span className="text-[10.5px] uppercase tracking-wider text-muted">{els.length > 1 ? 'multi' : el.type}</span>
        </div>
        <div className="flex justify-between">
          {([['left', AlignStartVertical], ['hcenter', AlignCenterVertical], ['right', AlignEndVertical], ['top', AlignStartHorizontal], ['vcenter', AlignCenterHorizontal], ['bottom', AlignEndHorizontal]] as const).map(([k, Icon]) => (
            <button key={k} className="icon-btn !px-1.5" title={`Align ${k}${els.length === 1 ? ' to artboard' : ''}`} onClick={() => actions.align(k)}><Icon size={15} /></button>
          ))}
          <button className="icon-btn !px-1.5" title="Distribute horizontally" disabled={els.length < 3} onClick={() => actions.distribute('x')}><AlignHorizontalSpaceAround size={15} /></button>
          <button className="icon-btn !px-1.5" title="Distribute vertically" disabled={els.length < 3} onClick={() => actions.distribute('y')}><AlignVerticalSpaceAround size={15} /></button>
        </div>
      </div>
      <Section title="Transform">
        <div className="grid grid-cols-2 gap-2">
          <NumberInput label="X" value={r.x} onChange={(v) => upd((d) => setAnimated(d, 'x', v, time, designView), 'x')} />
          <NumberInput label="Y" value={r.y} onChange={(v) => upd((d) => setAnimated(d, 'y', v, time, designView), 'y')} />
          {el.type === 'text' ? (
            <NumberInput label="Size" value={(el as TextElement).fontSize} min={4} onChange={(v) => upd((d) => { if (d.type === 'text') d.fontSize = v }, 'fs')} />
          ) : (
            <NumberInput label="W" value={el.width} min={1} onChange={(v) => upd((d) => { if (d.type !== 'text') d.width = v }, 'w')} />
          )}
          {el.type === 'text' ? <div /> : <NumberInput label="H" value={el.height} min={1} onChange={(v) => upd((d) => { if (d.type !== 'text') d.height = v }, 'h')} />}
          <NumberInput label="R" suffix="°" value={r.rotation} onChange={(v) => upd((d) => setAnimated(d, 'rotation', v, time, designView), 'rot')} />
        </div>
        <Slider label="Opacity" value={Math.round(el.opacity * 100)} min={0} max={100} suffix="%" onChange={(v) => upd((d) => { d.opacity = v / 100 }, 'opacity')} />
        <Row label="Blend">
          <Select className="w-full" value={el.blendMode} onChange={(v) => upd((d) => { d.blendMode = v })} options={BLENDS.map((b) => ({ value: b, label: blendLabel(b) }))} />
        </Row>
      </Section>
      {allText && t && <TextSection t={t} />}
      {els.length === 1 && el.type !== 'text' && el.type !== 'image' && el.type !== 'path' && <ShapeSection s={el as ShapeElement} />}
      {els.length === 1 && el.type === 'path' && <PathSection p={el as PathElement} />}
      {els.length === 1 && el.type === 'image' && <ImageSection im={el as ImageElement} />}
      {!(el.type === 'line' || el.type === 'arrow' || el.type === 'image' || (el.type === 'path' && el.brush === 'eraser')) && (
        <Section title={el.type === 'text' ? 'Text fill' : 'Fill'}>
          <FillEditor fill={el.fill} allowNone onChange={(f, key) => upd((d) => { d.fill = f }, key)} />
          {el.type === 'path' && !el.closed && <p className="text-[11px] text-muted">Gradient fills paint along open strokes.</p>}
        </Section>
      )}
      <Section title={el.type === 'text' ? 'Outline' : 'Stroke'} right={<Toggle checked={el.stroke.enabled} onChange={(v) => upd((d) => { d.stroke.enabled = v })} />}>
        <ColorInput value={el.stroke.color} onChange={(c) => upd((d) => { d.stroke.color = c; d.stroke.enabled = true }, 'sc')} />
        <Slider label="Width" value={el.stroke.width} min={0} max={el.type === 'path' ? 300 : 60} step={0.5} onChange={(v) => upd((d) => { d.stroke.width = v; d.stroke.enabled = true }, 'sw')} />
        <Slider label="Dash" value={el.stroke.dash ?? 0} min={0} max={60} onChange={(v) => upd((d) => { d.stroke.dash = v || undefined }, 'sd')} />
      </Section>
      {allText && t && (
        <Section title="Second outline" defaultOpen={t.outline2.enabled} right={<Toggle checked={t.outline2.enabled} onChange={(v) => upd((d) => { if (d.type === 'text') d.outline2.enabled = v })} />}>
          <ColorInput value={t.outline2.color} onChange={(c) => upd((d) => { if (d.type === 'text') { d.outline2.color = c; d.outline2.enabled = true } }, 'o2c')} />
          <Slider label="Width" value={t.outline2.width} min={0} max={60} step={0.5} onChange={(v) => upd((d) => { if (d.type === 'text') { d.outline2.width = v; d.outline2.enabled = true } }, 'o2w')} />
        </Section>
      )}
      <Section title="Shadow" defaultOpen={el.shadow.enabled} right={<Toggle checked={el.shadow.enabled} onChange={(v) => upd((d) => { d.shadow.enabled = v })} />}>
        <ColorInput value={el.shadow.color} onChange={(c) => upd((d) => { d.shadow.color = c; d.shadow.enabled = true }, 'shc')} />
        <Slider label="Blur" value={el.shadow.blur} min={0} max={120} onChange={(v) => upd((d) => { d.shadow.blur = v; d.shadow.enabled = true }, 'shb')} />
        <Slider label="Offset X" value={el.shadow.offsetX} min={-100} max={100} onChange={(v) => upd((d) => { d.shadow.offsetX = v; d.shadow.enabled = true }, 'shx')} />
        <Slider label="Offset Y" value={el.shadow.offsetY} min={-100} max={100} onChange={(v) => upd((d) => { d.shadow.offsetY = v; d.shadow.enabled = true }, 'shy')} />
      </Section>
      <Section title="Glow / Neon" defaultOpen={el.glow.enabled} right={<Toggle checked={el.glow.enabled} onChange={(v) => upd((d) => { d.glow.enabled = v })} />}>
        <ColorInput value={el.glow.color} onChange={(c) => upd((d) => { d.glow.color = c; d.glow.enabled = true }, 'gc')} />
        <Slider label="Radius" value={el.glow.blur} min={0} max={120} onChange={(v) => upd((d) => { d.glow.blur = v; d.glow.enabled = true }, 'gb')} />
        <Slider label="Intensity" value={el.glow.strength} min={1} max={5} onChange={(v) => upd((d) => { d.glow.strength = v; d.glow.enabled = true }, 'gs')} />
      </Section>
      {allText && t && (
        <>
          <Section title="3D extrude" defaultOpen={t.extrude.enabled} right={<Toggle checked={t.extrude.enabled} onChange={(v) => upd((d) => { if (d.type === 'text') d.extrude.enabled = v })} />}>
            <ColorInput value={t.extrude.color} onChange={(c) => upd((d) => { if (d.type === 'text') { d.extrude.color = c; d.extrude.enabled = true } }, 'exc')} />
            <Slider label="Depth" value={t.extrude.depth} min={1} max={80} onChange={(v) => upd((d) => { if (d.type === 'text') { d.extrude.depth = v; d.extrude.enabled = true } }, 'exd')} />
            <Slider label="Angle" value={t.extrude.angle} min={0} max={360} suffix="°" onChange={(v) => upd((d) => { if (d.type === 'text') { d.extrude.angle = v; d.extrude.enabled = true } }, 'exa')} />
          </Section>
          <Section title="Glitch split" defaultOpen={t.rgbSplit > 0}>
            <Slider label="RGB offset" value={t.rgbSplit} min={0} max={30} step={0.5} onChange={(v) => upd((d) => { if (d.type === 'text') d.rgbSplit = v }, 'rgb')} />
          </Section>
        </>
      )}
    </>
  )
}

function TextSection({ t }: { t: TextElement }) {
  const upd = (fn: (d: Draft<TextElement>) => void, key?: string) => actions.updateSelected((d) => { if (d.type === 'text') fn(d as Draft<TextElement>) }, key)
  const font = FONTS.find((f) => f.family === t.fontFamily)
  const cats = ['Sans', 'Serif', 'Display', 'Script', 'Mono', 'Bangla'] as const
  return (
    <Section title="Typography">
      <textarea className="field w-full !h-auto py-1.5 resize-y min-h-[52px] leading-snug" value={t.text} onKeyDown={(e) => e.stopPropagation()} onChange={(e) => upd((d) => { d.text = e.target.value }, 'text')} />
      <select className="field w-full" value={t.fontFamily} style={{ fontFamily: t.fontFamily }} onKeyDown={(e) => e.stopPropagation()}
        onChange={(e) => { const fam = e.target.value; const w = closestWeight(fam, t.fontWeight); ensureFont(fam, w, t.italic); upd((d) => { d.fontFamily = fam; d.fontWeight = w }) }}>
        {cats.map((c) => (
          <optgroup key={c} label={c}>
            {FONTS.filter((f) => f.category === c).map((f) => <option key={f.family} value={f.family} style={{ fontFamily: f.family }}>{f.family}</option>)}
          </optgroup>
        ))}
      </select>
      <div className="flex gap-2">
        <Select className="flex-1" value={String(t.fontWeight)} onChange={(v) => { ensureFont(t.fontFamily, +v, t.italic); upd((d) => { d.fontWeight = +v }) }} options={(font?.weights ?? [400, 700]).map((w) => ({ value: String(w), label: `${w} ${['', 'Thin', 'ExtraLight', 'Light', 'Regular', 'Medium', 'SemiBold', 'Bold', 'ExtraBold', 'Black'][w / 100]}` }))} />
        <button className={`icon-btn border border-line ${t.italic ? 'on' : ''}`} title="Italic" onClick={() => upd((d) => { d.italic = !d.italic })}><Italic size={14} /></button>
      </div>
      <Slider label="Size" value={Math.round(t.fontSize)} min={6} max={600} onChange={(v) => upd((d) => { d.fontSize = v }, 'fs')} />
      <Slider label="Spacing" value={t.letterSpacing} min={-20} max={80} step={0.5} onChange={(v) => upd((d) => { d.letterSpacing = v }, 'ls')} />
      <Slider label="Line height" value={t.lineHeight} min={0.6} max={3} step={0.05} onChange={(v) => upd((d) => { d.lineHeight = v }, 'lh')} />
      <div className="flex gap-2">
        <Segmented value={t.align} onChange={(v) => upd((d) => { d.align = v })} options={[{ value: 'left', label: <AlignLeft size={14} /> }, { value: 'center', label: <AlignCenter size={14} /> }, { value: 'right', label: <AlignRight size={14} /> }]} />
        <Segmented value={t.transform} onChange={(v) => upd((d) => { d.transform = v })} options={[{ value: 'none', label: 'Aa' }, { value: 'uppercase', label: 'AA' }, { value: 'lowercase', label: 'aa' }]} />
      </div>
      <div className="pt-1">
        <div className="text-[12px] text-muted mb-1.5">Warp</div>
        <Segmented value={t.warp} onChange={(v) => upd((d) => { d.warp = v; if (v === 'wave' && Math.abs(d.warpAmount) > 100) d.warpAmount = 40 })} options={[{ value: 'none', label: 'None' }, { value: 'arc', label: 'Arc' }, { value: 'wave', label: 'Wave' }, { value: 'circle', label: 'Circle' }]} />
      </div>
      {(t.warp === 'arc' || t.warp === 'wave') && <Slider label={t.warp === 'arc' ? 'Bend' : 'Amplitude'} value={t.warpAmount} min={t.warp === 'arc' ? -360 : -100} max={t.warp === 'arc' ? 360 : 100} onChange={(v) => upd((d) => { d.warpAmount = v }, 'warp')} suffix={t.warp === 'arc' ? '°' : '%'} />}
    </Section>
  )
}

function ShapeSection({ s }: { s: ShapeElement }) {
  const upd = (fn: (d: Draft<ShapeElement>) => void, key?: string) => actions.updateEl(s.id, (d) => fn(d as Draft<ShapeElement>), key)
  if (s.type === 'line' || s.type === 'arrow' || s.type === 'ellipse') return null
  return (
    <Section title="Shape">
      {s.type === 'rect' && <Slider label="Corners" value={s.radius ?? 0} min={0} max={Math.round(Math.min(s.width, s.height) / 2)} onChange={(v) => upd((d) => { d.radius = v }, 'rad')} />}
      {(s.type === 'polygon' || s.type === 'star') && <Slider label={s.type === 'star' ? 'Points' : 'Sides'} value={s.sides ?? 5} min={3} max={24} onChange={(v) => upd((d) => { d.sides = v }, 'sides')} />}
      {s.type === 'star' && <Slider label="Inner" value={Math.round((s.innerRatio ?? 0.45) * 100)} min={5} max={95} suffix="%" onChange={(v) => upd((d) => { d.innerRatio = v / 100 }, 'inner')} />}
    </Section>
  )
}

function PathSection({ p }: { p: PathElement }) {
  const upd = (fn: (d: Draft<PathElement>) => void, key?: string) => actions.updateEl(p.id, (d) => fn(d as Draft<PathElement>), key)
  if (p.brush === 'eraser') return <Section title="Eraser stroke"><Slider label="Size" value={p.stroke.width} min={1} max={300} onChange={(v) => upd((d) => { d.stroke.width = v }, 'ew')} /></Section>
  return (
    <Section title="Path">
      <Row label="Brush"><Select className="w-full" value={p.brush} onChange={(v) => upd((d) => { d.brush = v })} options={['pen', 'pencil', 'brush', 'marker', 'highlighter'].map((b) => ({ value: b as PathElement['brush'], label: b[0].toUpperCase() + b.slice(1) }))} /></Row>
      <Row label="Smooth"><Toggle checked={p.smooth} onChange={(v) => upd((d) => { d.smooth = v })} /></Row>
      <Row label="Closed"><Toggle checked={p.closed} onChange={(v) => upd((d) => { d.closed = v; if (v && d.fill.type === 'none') d.fill = { type: 'solid', color: d.stroke.color + '66' } })} /></Row>
    </Section>
  )
}

const IMAGE_PRESETS: { name: string; f: Partial<ImageElement['filters']> }[] = [
  { name: 'Original', f: {} },
  { name: 'B&W', f: { grayscale: 100, contrast: 115 } },
  { name: 'Vintage', f: { sepia: 60, contrast: 90, brightness: 105, saturate: 80 } },
  { name: 'Vivid', f: { saturate: 160, contrast: 115 } },
  { name: 'Cool', f: { hueRotate: 200, saturate: 70, brightness: 105 } },
  { name: 'Warm', f: { sepia: 25, saturate: 130, brightness: 105 } },
  { name: 'Noir', f: { grayscale: 100, contrast: 160, brightness: 85 } },
  { name: 'Dream', f: { blur: 2, brightness: 115, saturate: 120 } },
  { name: 'Invert', f: { invert: 100 } },
]
const DEFAULT_FILTERS: ImageElement['filters'] = { brightness: 100, contrast: 100, saturate: 100, blur: 0, grayscale: 0, sepia: 0, hueRotate: 0, invert: 0 }

function ImageSection({ im }: { im: ImageElement }) {
  const upd = (fn: (d: Draft<ImageElement>) => void, key?: string) => actions.updateEl(im.id, (d) => fn(d as Draft<ImageElement>), key)
  const f = im.filters
  const S = (label: string, k: keyof ImageElement['filters'], min: number, max: number, suffix = '%') => (
    <Slider label={label} value={f[k]} min={min} max={max} suffix={suffix} onChange={(v) => upd((d) => { d.filters[k] = v }, `f-${k}`)} />
  )
  return (
    <Section title="Image filters" right={<button className="icon-btn !h-6" title="Reset" onClick={() => upd((d) => { d.filters = { ...DEFAULT_FILTERS } })}><RotateCcw size={12} /></button>}>
      <div className="flex flex-wrap gap-1.5">
        {IMAGE_PRESETS.map((p) => <button key={p.name} className="chip" onClick={() => upd((d) => { d.filters = { ...DEFAULT_FILTERS, ...p.f } })}>{p.name}</button>)}
      </div>
      {S('Brightness', 'brightness', 0, 200)}
      {S('Contrast', 'contrast', 0, 200)}
      {S('Saturation', 'saturate', 0, 300)}
      {S('Blur', 'blur', 0, 40, 'px')}
      {S('Grayscale', 'grayscale', 0, 100)}
      {S('Sepia', 'sepia', 0, 100)}
      {S('Hue', 'hueRotate', 0, 360, '°')}
      {S('Invert', 'invert', 0, 100)}
      <Slider label="Corners" value={im.radius} min={0} max={Math.round(Math.min(im.width, im.height) / 2)} onChange={(v) => upd((d) => { d.radius = v }, 'irad')} />
    </Section>
  )
}

// ——— Animate panel ———

export function EasingCurve({ name, size = 34 }: { name: string; size?: number }) {
  const fn = getEasing(name)
  const pts = Array.from({ length: 41 }, (_, i) => { const x = i / 40; const y = fn(x); return `${(x * (size - 6) + 3).toFixed(1)},${(size - 3 - y * (size - 14) - 5).toFixed(1)}` })
  return (
    <svg width={size} height={size} className="shrink-0 rounded-md bg-panel2 border border-line">
      <polyline points={pts.join(' ')} fill="none" stroke="var(--accent)" strokeWidth="1.6" />
    </svg>
  )
}

const EASE_OPTS = EASING_NAMES.map((e) => ({ value: e, label: e }))

function AnimatePanel({ el, count }: { el: DesignElement; count: number }) {
  const [kind, setKind] = useState<PresetKind>('enter')
  const duration = useStore((s) => s.project.duration)
  const time = useStore((s) => s.time)
  const key = kind === 'enter' ? 'enter' : kind === 'exit' ? 'exit' : 'emphasis'
  const clip = el.anim[key]
  const isText = el.type === 'text'
  const presets = presetsOf(kind).filter((p) => isText || !p.textOnly)
  const cats = [...new Set(presets.map((p) => p.category))]
  const setClip = (c: PresetClip | undefined, k?: string) => actions.updateSelected((d) => { d.anim[key] = c }, k)
  const preview = () => {
    const start = kind === 'exit' ? Math.max(el.anim.start, el.anim.end - (clip?.duration ?? 1) - 0.4) : el.anim.start
    actions.setTime(start)
    actions.play()
  }
  return (
    <>
      <Section title="Timing">
        <div className="grid grid-cols-2 gap-2">
          <NumberInput label="Start" suffix="s" step={0.1} min={0} max={duration} value={el.anim.start} onChange={(v) => actions.updateSelected((d) => { d.anim.start = Math.min(v, d.anim.end - 0.1) }, 'start')} />
          <NumberInput label="End" suffix="s" step={0.1} min={0} max={duration} value={el.anim.end} onChange={(v) => actions.updateSelected((d) => { d.anim.end = Math.max(v, d.anim.start + 0.1) }, 'end')} />
        </div>
        {count > 1 && <p className="text-[11px] text-muted">Changes apply to all {count} selected layers.</p>}
      </Section>
      <div className="px-3 pt-3">
        <Segmented value={kind} onChange={setKind} options={[{ value: 'enter', label: 'In' }, { value: 'emphasis', label: 'Loop' }, { value: 'exit', label: 'Out' }]} />
      </div>
      <div className="px-3 py-3 border-b border-line space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="font-semibold">{clip ? presets.find((p) => p.id === clip.preset)?.name ?? clip.preset : <span className="text-muted font-normal">No {kind === 'enter' ? 'entrance' : kind === 'exit' ? 'exit' : 'emphasis'} animation</span>}</div>
          <div className="flex gap-1">
            {clip && <button className="icon-btn" title="Preview" onClick={preview}><Play size={14} /></button>}
            {clip && <button className="icon-btn" title="Remove" onClick={() => setClip(undefined)}><Trash2 size={14} /></button>}
          </div>
        </div>
        {clip && (
          <>
            <Slider label={kind === 'emphasis' ? 'Period' : 'Duration'} value={clip.duration} min={0.1} max={Math.max(4, duration)} step={0.05} suffix="s" onChange={(v) => setClip({ ...clip, duration: v }, 'cdur')} />
            {kind !== 'exit' && <Slider label="Delay" value={clip.delay} min={0} max={duration} step={0.05} suffix="s" onChange={(v) => setClip({ ...clip, delay: v }, 'cdel')} />}
            {kind !== 'emphasis' && (
              <Row label="Easing">
                <Select className="flex-1" value={clip.easing} onChange={(v) => setClip({ ...clip, easing: v })} options={EASE_OPTS} />
                <EasingCurve name={clip.easing} size={30} />
              </Row>
            )}
            {kind === 'emphasis' && <Row label="Loop"><Toggle checked={!!clip.loop} onChange={(v) => setClip({ ...clip, loop: v })} /></Row>}
          </>
        )}
      </div>
      <div className="px-3 py-3 border-b border-line space-y-3">
        {cats.map((c) => (
          <div key={c}>
            <div className="section-title mb-1.5">{c}</div>
            <div className="flex flex-wrap gap-1.5">
              {presets.filter((p) => p.category === c).map((p) => (
                <button key={p.id} className={`chip ${clip?.preset === p.id ? 'active' : ''}`} onClick={() => {
                  const c2 = makeClip(kind, p.id)
                  setClip(clip ? { ...c2, delay: clip.delay } : c2)
                  setTimeout(preview, 0)
                }}>{p.name}</button>
              ))}
            </div>
          </div>
        ))}
        <div className="text-[11px] text-muted">{presets.length} {kind === 'enter' ? 'entrance' : kind === 'exit' ? 'exit' : 'emphasis'} presets{isText ? ' (incl. letter-by-letter)' : ' · select text for letter effects'}</div>
      </div>
      {count === 1 && <KeyframeSection el={el} time={time} />}
    </>
  )
}

function KeyframeSection({ el, time }: { el: DesignElement; time: number }) {
  const kf = el.anim.keyframes
  const times = [...new Set(Object.values(kf).flatMap((tr) => (tr ?? []).map((k) => Math.round(k.t * 1000) / 1000)))].sort((a, b) => a - b)
  const value = (p: AnimProp) => interpolate(kf[p], time, p === 'scale' || p === 'opacity' ? 1 : (el as unknown as Record<string, number>)[p])
  const firstAt = (t: number): Keyframe | undefined => Object.values(kf).flatMap((x) => x ?? []).find((k) => Math.abs(k.t - t) < 1e-3)
  const labels: Record<AnimProp, string> = { x: 'X', y: 'Y', scale: 'Scale', rotation: 'Rotate', opacity: 'Opacity' }
  return (
    <Section title="Keyframes" right={times.length ? <button className="text-[11px] text-muted hover:text-ink" onClick={() => actions.clearKeyframes(el.id)}>Clear</button> : undefined}>
      <button className="btn w-full justify-center" onClick={() => actions.addKeyframe(el.id)}><Diamond size={13} className="text-accent" />Add keyframe at {time.toFixed(2)}s</button>
      {times.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-2">
            {KEYFRAME_PROPS.map((p) => (
              <NumberInput key={p} label={labels[p]} step={p === 'scale' || p === 'opacity' ? 0.05 : 1} value={value(p)} onChange={(v) => actions.setKeyframeValue(el.id, p, p === 'opacity' ? Math.max(0, Math.min(1, v)) : v)} />
            ))}
          </div>
          <div className="space-y-1">
            {times.map((t) => {
              const k = firstAt(t)
              return (
                <div key={t} className={`flex items-center gap-2 h-8 px-2 rounded-lg ${Math.abs(t - time) < 0.02 ? 'bg-hover' : ''}`}>
                  <button className="flex items-center gap-1.5 text-[12px] tabular-nums w-16" onClick={() => actions.setTime(t)}><Diamond size={11} className="text-accent fill-current" />{t.toFixed(2)}s</button>
                  <select className="field !h-6 flex-1 text-[11px]" value={k?.easing ?? 'easeInOutCubic'} onKeyDown={(e) => e.stopPropagation()}
                    onChange={(e) => actions.updateEl(el.id, (d) => { for (const p of KEYFRAME_PROPS) { const tr = d.anim.keyframes[p]; if (tr) for (const f of tr) if (Math.abs(f.t - t) < 1e-3) f.easing = e.target.value } })}>
                    {EASING_NAMES.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <button className="icon-btn !h-6 !min-w-6 !p-0" onClick={() => actions.removeKeyframesAt(el.id, t)} aria-label="Delete keyframe"><Trash2 size={12} /></button>
                </div>
              )
            })}
          </div>
        </>
      )}
      <p className="text-[11px] text-muted leading-relaxed">Add a keyframe, move the playhead, then drag/rotate the layer or edit values — new keyframes are recorded automatically. Easing applies from each keyframe to the next.</p>
    </Section>
  )
}
