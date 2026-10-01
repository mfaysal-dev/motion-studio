import { useState } from 'react'
import { Layers, Sparkles, Shapes, Brush, Eye, EyeOff, Lock, Unlock, Type, Square, Circle, Hexagon, Star, Minus, MoveRight, PenTool, Image as ImageIcon, Eraser, Group, Ungroup, ArrowUp, ArrowDown, Trash2, ImagePlus, Highlighter, Pencil, Paintbrush } from 'lucide-react'
import { useStore, actions } from '../store'
import type { DesignElement, TextElement } from '../core/types'
import { TEXT_STYLES } from '../core/styles'
import { createShape, createText, solid } from '../core/elements'
import { StylePreview } from './StylePreview'
import { Slider, ColorInput, Segmented, Toggle, Row } from './ui'
import { addImageFile, pickFile } from '../lib/upload'
import type { Draft } from 'immer'

const TYPE_ICON: Record<string, typeof Type> = { text: Type, rect: Square, ellipse: Circle, polygon: Hexagon, star: Star, line: Minus, arrow: MoveRight, path: PenTool, image: ImageIcon }

export function LeftPanel() {
  const tab = useStore((s) => s.leftTab)
  const tabs = [
    { id: 'layers', icon: Layers, label: 'Layers' },
    { id: 'styles', icon: Sparkles, label: 'Styles' },
    { id: 'elements', icon: Shapes, label: 'Elements' },
    { id: 'draw', icon: Brush, label: 'Draw' },
  ] as const
  return (
    <div className="w-[264px] max-xl:w-[240px] shrink-0 bg-panel border-r border-line flex flex-col min-h-0 max-lg:hidden">
      <div className="flex gap-1 p-2 border-b border-line">
        {tabs.map((t) => (
          <button key={t.id} className={`tab flex-1 flex flex-col items-center gap-1 py-1.5 ${tab === t.id ? 'active' : ''}`} onClick={() => useStore.setState({ leftTab: t.id })}>
            <t.icon size={15} />
            <span className="text-[10.5px]">{t.label}</span>
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {tab === 'layers' && <LayersTab />}
        {tab === 'styles' && <StylesTab />}
        {tab === 'elements' && <ElementsTab />}
        {tab === 'draw' && <DrawTab />}
      </div>
    </div>
  )
}

function LayersTab() {
  const elements = useStore((s) => s.project.elements)
  const selection = useStore((s) => s.selection)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)
  const list = [...elements].reverse()
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <span className="section-title">Layers · {elements.length}</span>
        <div className="flex">
          <button className="icon-btn" title="Group (Ctrl+G)" disabled={selection.length < 2} onClick={actions.group}><Group size={14} /></button>
          <button className="icon-btn" title="Ungroup (Ctrl+Shift+G)" disabled={!selection.length} onClick={actions.ungroup}><Ungroup size={14} /></button>
          <button className="icon-btn" title="Bring forward (Ctrl+])" disabled={!selection.length} onClick={() => actions.reorder('up')}><ArrowUp size={14} /></button>
          <button className="icon-btn" title="Send backward (Ctrl+[)" disabled={!selection.length} onClick={() => actions.reorder('down')}><ArrowDown size={14} /></button>
          <button className="icon-btn" title="Delete (Del)" disabled={!selection.length} onClick={actions.deleteSelection}><Trash2 size={14} /></button>
        </div>
      </div>
      {!list.length && <div className="px-4 py-10 text-center text-muted text-[12px]">No layers yet. Pick a tool on the left, or start from a template.</div>}
      <div className="px-2 pb-3 space-y-[2px]">
        {list.map((el, i) => {
          const Icon = el.type === 'path' && el.brush === 'eraser' ? Eraser : TYPE_ICON[el.type]
          const sel = selection.includes(el.id)
          const groupStart = el.groupId && list[i - 1]?.groupId !== el.groupId
          return (
            <div key={el.id}>
              {groupStart && <div className="text-[10px] uppercase tracking-wider text-muted px-2 pt-1.5 pb-0.5">Group</div>}
              <div
                draggable={renaming !== el.id}
                onDragStart={() => setDragId(el.id)}
                onDragOver={(e) => { e.preventDefault(); setOverIdx(i) }}
                onDragLeave={() => setOverIdx(null)}
                onDrop={() => { if (dragId) actions.moveLayer(dragId, elements.length - 1 - i); setDragId(null); setOverIdx(null) }}
                onDragEnd={() => { setDragId(null); setOverIdx(null) }}
                onClick={(e) => actions.select([el.id], e.shiftKey || e.metaKey || e.ctrlKey ? 'toggle' : 'replace')}
                onDoubleClick={() => setRenaming(el.id)}
                className={`group flex items-center gap-2 h-9 px-2 rounded-lg cursor-default select-none transition-colors ${sel ? 'bg-[color-mix(in_oklab,var(--accent)_20%,transparent)] text-ink' : 'hover:bg-hover'} ${el.groupId ? 'ml-3' : ''} ${overIdx === i && dragId !== el.id ? 'ring-1 ring-accent' : ''} ${!el.visible ? 'opacity-50' : ''}`}
              >
                <LayerThumb el={el} />
                <Icon size={13} className="text-muted shrink-0" />
                {renaming === el.id ? (
                  <input autoFocus defaultValue={el.name} className="field h-6 flex-1 text-[12px]"
                    onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setRenaming(null) }}
                    onBlur={(e) => { const v = e.target.value.trim(); if (v) actions.updateEl(el.id, (d) => { d.name = v }); setRenaming(null) }} />
                ) : (
                  <span className="flex-1 truncate text-[12.5px]">{el.type === 'text' ? (el as TextElement).text.split('\n')[0] || el.name : el.name}</span>
                )}
                <button className={`icon-btn !h-6 !min-w-6 !p-0 ${el.locked ? '' : 'opacity-0 group-hover:opacity-100'}`} title={el.locked ? 'Unlock' : 'Lock'} onClick={(e) => { e.stopPropagation(); actions.updateEl(el.id, (d) => { d.locked = !d.locked }) }}>
                  {el.locked ? <Lock size={12} /> : <Unlock size={12} />}
                </button>
                <button className={`icon-btn !h-6 !min-w-6 !p-0 ${el.visible ? 'opacity-0 group-hover:opacity-100' : ''}`} title={el.visible ? 'Hide' : 'Show'} onClick={(e) => { e.stopPropagation(); actions.updateEl(el.id, (d) => { d.visible = !d.visible }) }}>
                  {el.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function LayerThumb({ el }: { el: DesignElement }) {
  const c = el.type === 'path' ? el.stroke.color : el.fill.type === 'solid' ? el.fill.color : el.fill.type === 'linear' || el.fill.type === 'radial' ? `linear-gradient(135deg, ${el.fill.stops.map((s) => s.color).join(',')})` : el.stroke.color
  if (el.type === 'image') return <span className="w-5 h-5 rounded bg-cover bg-center shrink-0 border border-line" style={{ backgroundImage: `url(${el.src})` }} />
  return <span className="w-5 h-5 rounded shrink-0 border border-line checker overflow-hidden"><span className="block w-full h-full" style={{ background: c }} /></span>
}

function StylesTab() {
  const selection = useStore((s) => s.selection)
  const elements = useStore((s) => s.project.elements)
  const texts = elements.filter((e) => selection.includes(e.id) && e.type === 'text')
  const apply = (style: Partial<TextElement>, sample?: string) => {
    if (texts.length) {
      actions.updateSelected((el) => { if (el.type !== 'text') return; Object.assign(el as Draft<TextElement>, structuredClone(style)) })
    } else {
      const s = useStore.getState()
      const { width: W, height: H } = s.project.artboard
      const el = createText({ ...structuredClone(style), text: sample ?? 'Headline', x: W / 2, y: H / 2, fontSize: Math.round(W / 9) }, s.project.duration)
      actions.addElements([el])
    }
  }
  return (
    <div className="p-3">
      <p className="text-muted text-[12px] mb-3 leading-relaxed">{texts.length ? <>Click a style to apply it to <b className="text-ink">{texts.length} selected text</b>.</> : 'Click a style to add a new styled headline. Select text first to restyle it.'}</p>
      <div className="grid grid-cols-2 gap-2">
        {TEXT_STYLES.map((st) => (
          <button key={st.id} onClick={() => apply(st.style, st.sample)} className="group rounded-[12px] border border-line hover:border-accent transition-colors p-[3px] text-left flex flex-col items-center" title={st.name}>
            <StylePreview style={st.style} text={st.sample ?? "Aa Bb"} bg={st.bg} width={104} height={60} />
            <div className="self-stretch text-[11px] px-1 pt-1 pb-0.5 text-muted group-hover:text-ink truncate">{st.name}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

function ElementsTab() {
  const add = (el: DesignElement) => actions.addElements([el])
  const center = () => { const s = useStore.getState(); return { x: s.project.artboard.width / 2, y: s.project.artboard.height / 2, d: s.project.duration, u: Math.min(s.project.artboard.width, s.project.artboard.height) } }
  const color = useStore((s) => s.brush.color)
  const shapes = [
    { t: 'rect' as const, icon: Square, label: 'Rectangle' },
    { t: 'ellipse' as const, icon: Circle, label: 'Circle' },
    { t: 'polygon' as const, icon: Hexagon, label: 'Polygon' },
    { t: 'star' as const, icon: Star, label: 'Star' },
    { t: 'line' as const, icon: Minus, label: 'Line' },
    { t: 'arrow' as const, icon: MoveRight, label: 'Arrow' },
  ]
  return (
    <div className="p-3 space-y-5">
      <div>
        <div className="section-title mb-2">Text</div>
        <div className="space-y-1.5">
          {[
            { label: 'Add a heading', size: 0.11, weight: 800, font: 'Poppins' },
            { label: 'Add a subheading', size: 0.06, weight: 600, font: 'Inter' },
            { label: 'Add body text', size: 0.035, weight: 400, font: 'Inter' },
          ].map((t) => (
            <button key={t.label} className="w-full text-left px-3 py-2.5 rounded-xl bg-panel2 border border-line hover:border-accent transition-colors"
              style={{ fontFamily: t.font, fontWeight: t.weight, fontSize: 18 * (t.size / 0.11) + 4 }}
              onClick={() => { const c = center(); add(createText({ text: t.label.replace('Add a ', '').replace('Add ', ''), x: c.x, y: c.y, fontSize: Math.round(c.u * t.size), fontWeight: t.weight, fontFamily: t.font }, c.d)) }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="section-title mb-2">Shapes</div>
        <div className="grid grid-cols-3 gap-2">
          {shapes.map((s) => (
            <button key={s.t} className="aspect-square rounded-xl bg-panel2 border border-line hover:border-accent flex flex-col items-center justify-center gap-1.5 transition-colors" onClick={() => {
              const c = center()
              const size = c.u * 0.3
              add(createShape(s.t, s.t === 'line' || s.t === 'arrow' ? { x: c.x, y: c.y, width: size * 1.4, stroke: { enabled: true, color, width: Math.max(4, c.u / 120) } } : { x: c.x, y: c.y, width: size, height: size, fill: solid(color) }, c.d))
            }}>
              <s.icon size={22} strokeWidth={1.6} />
              <span className="text-[10.5px] text-muted">{s.label}</span>
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="section-title mb-2">Media</div>
        <button className="w-full h-24 rounded-xl border border-dashed border-line hover:border-accent flex flex-col items-center justify-center gap-2 text-muted hover:text-ink transition-colors"
          onClick={async () => { const f = await pickFile('image/*'); if (f) addImageFile(f) }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) addImageFile(f) }}>
          <ImagePlus size={22} />
          <span className="text-[12px]">Upload or drop an image</span>
        </button>
      </div>
    </div>
  )
}

const SWATCHES = ['#ffffff', '#111111', '#ff4fd8', '#8b6cff', '#22d3ee', '#22c55e', '#facc15', '#fb923c', '#ef4444', '#f472b6', '#38bdf8', '#a3e635']

function DrawTab() {
  const brush = useStore((s) => s.brush)
  const tool = useStore((s) => s.tool)
  const set = (p: Partial<typeof brush>) => useStore.setState({ brush: { ...brush, ...p } })
  const types = [
    { value: 'pencil' as const, label: <Pencil size={14} />, title: 'Pencil' },
    { value: 'brush' as const, label: <Paintbrush size={14} />, title: 'Brush' },
    { value: 'marker' as const, label: <PenTool size={14} />, title: 'Marker' },
    { value: 'highlighter' as const, label: <Highlighter size={14} />, title: 'Highlighter' },
  ]
  return (
    <div className="p-3 space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {([['brush', Brush, 'Brush'], ['pen', PenTool, 'Pen'], ['eraser', Eraser, 'Eraser']] as const).map(([id, Icon, label]) => (
          <button key={id} onClick={() => useStore.setState({ tool: id })} className={`h-16 rounded-xl border flex flex-col items-center justify-center gap-1 transition-colors ${tool === id ? 'border-accent bg-[color-mix(in_oklab,var(--accent)_16%,transparent)]' : 'border-line bg-panel2 hover:border-accent'}`}>
            <Icon size={18} /><span className="text-[11px]">{label}</span>
          </button>
        ))}
      </div>
      <div>
        <div className="section-title mb-2">Brush type</div>
        <Segmented value={brush.type} onChange={(v) => set({ type: v })} options={types} />
        <div className="text-[11px] text-muted mt-1.5 capitalize">{brush.type}{brush.type === 'highlighter' ? ' — translucent, multiplies over artwork' : brush.type === 'brush' ? ' — soft round edge' : brush.type === 'marker' ? ' — solid, crisp' : ' — thin & textured'}</div>
      </div>
      <div className="space-y-2.5">
        <Slider label="Size" value={brush.size} min={1} max={160} onChange={(v) => set({ size: v })} suffix="px" />
        <Slider label="Opacity" value={Math.round(brush.opacity * 100)} min={5} max={100} onChange={(v) => set({ opacity: v / 100 })} suffix="%" />
        <Slider label="Smoothing" value={Math.round(brush.smoothing * 100)} min={0} max={90} onChange={(v) => set({ smoothing: v / 100 })} suffix="%" />
        <Slider label="Eraser" value={brush.eraserSize} min={4} max={300} onChange={(v) => set({ eraserSize: v })} suffix="px" />
      </div>
      <div>
        <div className="section-title mb-2">Color</div>
        <ColorInput value={brush.color} onChange={(v) => set({ color: v })} />
        <div className="grid grid-cols-6 gap-1.5 mt-2">
          {SWATCHES.map((c) => (
            <button key={c} onClick={() => set({ color: c })} className={`aspect-square rounded-lg border ${brush.color === c ? 'ring-2 ring-accent border-transparent' : 'border-line'}`} style={{ background: c }} aria-label={c} />
          ))}
        </div>
      </div>
      <Row label="Pen curves"><Toggle checked={brush.smoothing > 0.05} onChange={(v) => set({ smoothing: v ? 0.5 : 0 })} /></Row>
      <p className="text-[11.5px] text-muted leading-relaxed">Tip: every stroke becomes its own layer — move it, recolor it, add glow, or animate it like any other element. The eraser cuts through artwork beneath it.</p>
    </div>
  )
}
