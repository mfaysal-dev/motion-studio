import type { Fill } from '../core/types'
import { ColorInput, Segmented, Slider, Select } from './ui'
import { PATTERNS, fillToCss, primaryColor } from '../core/paint'
import { fileToDataUrl } from '../lib/upload'
import { pickFile } from '../lib/upload'
import { Plus, X } from 'lucide-react'

const GRADIENTS: string[][] = [
  ['#8b6cff', '#22d3ee'], ['#ff9a3c', '#ff4f6d', '#a12bff'], ['#fffb96', '#ff71ce', '#b967ff'], ['#43e97b', '#38f9d7'],
  ['#fa709a', '#fee140'], ['#30cfd0', '#330867'], ['#f6d365', '#fda085'], ['#fff3b0', '#e2b13c', '#9a6b12'],
  ['#ffffff', '#c9d1db', '#5b6573'], ['#0f0c29', '#302b63', '#24243e'], ['#ff0844', '#ffb199'], ['#13547a', '#80d0c7'],
]

export function FillEditor({ fill, onChange, allowNone = true, allowPattern = true }: { fill: Fill; onChange: (f: Fill, key?: string) => void; allowNone?: boolean; allowPattern?: boolean }) {
  const base = primaryColor(fill)
  const stops = fill.type === 'linear' || fill.type === 'radial' ? fill.stops : [{ offset: 0, color: base }, { offset: 1, color: '#22d3ee' }]
  const types = [
    ...(allowNone ? [{ value: 'none' as const, label: 'None' }] : []),
    { value: 'solid' as const, label: 'Solid' },
    { value: 'linear' as const, label: 'Linear' },
    { value: 'radial' as const, label: 'Radial' },
    ...(allowPattern ? [{ value: 'pattern' as const, label: 'Pattern' }] : []),
  ]
  const setType = (t: Fill['type']) => {
    if (t === 'none') onChange({ type: 'none' })
    else if (t === 'solid') onChange({ type: 'solid', color: base })
    else if (t === 'linear') onChange({ type: 'linear', angle: fill.type === 'linear' ? fill.angle : 90, stops })
    else if (t === 'radial') onChange({ type: 'radial', stops })
    else onChange({ type: 'pattern', pattern: 'stripes', scale: 0.6, colors: [base, '#ffffff'] })
  }
  return (
    <div className="space-y-2.5">
      <Segmented value={fill.type} onChange={setType} options={types} />
      {fill.type === 'solid' && <ColorInput value={fill.color} onChange={(c) => onChange({ type: 'solid', color: c }, 'fill-color')} />}
      {(fill.type === 'linear' || fill.type === 'radial') && (
        <>
          <div className="h-6 rounded-lg border border-line" style={{ background: fillToCss({ ...fill, ...(fill.type === 'radial' ? {} : { angle: 90 }) } as Fill) }} />
          {fill.stops.map((s, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <ColorInput className="flex-1" value={s.color} onChange={(c) => onChange({ ...fill, stops: fill.stops.map((x, j) => (j === i ? { ...x, color: c } : x)) }, `stop-${i}`)} />
              <input type="range" className="range w-16" min={0} max={100} value={Math.round(s.offset * 100)} style={{ ['--pct' as string]: `${s.offset * 100}%` }}
                onChange={(e) => onChange({ ...fill, stops: fill.stops.map((x, j) => (j === i ? { ...x, offset: parseInt(e.target.value) / 100 } : x)) }, `off-${i}`)} />
              <button className="icon-btn !min-w-6 !h-6 !p-0" disabled={fill.stops.length <= 2} onClick={() => onChange({ ...fill, stops: fill.stops.filter((_, j) => j !== i) })} aria-label="Remove stop"><X size={12} /></button>
            </div>
          ))}
          {fill.stops.length < 5 && (
            <button className="text-[12px] text-accent flex items-center gap-1" onClick={() => onChange({ ...fill, stops: [...fill.stops, { offset: 1, color: '#ffffff' }].map((s, i, a) => ({ ...s, offset: i / (a.length - 1) })) })}><Plus size={12} />Add color stop</button>
          )}
          {fill.type === 'linear' && <Slider label="Angle" value={fill.angle} min={0} max={360} onChange={(v) => onChange({ ...fill, angle: v }, 'angle')} suffix="°" />}
          <div className="grid grid-cols-6 gap-1.5 pt-1">
            {GRADIENTS.map((g, i) => (
              <button key={i} className="aspect-square rounded-lg border border-line hover:scale-105 transition-transform" style={{ background: `linear-gradient(135deg, ${g.join(',')})` }}
                onClick={() => onChange({ type: fill.type, angle: fill.type === 'linear' ? fill.angle : 90, stops: g.map((c, j) => ({ offset: j / (g.length - 1), color: c })) } as Fill)} aria-label="Gradient preset" />
            ))}
          </div>
        </>
      )}
      {fill.type === 'pattern' && (
        <>
          <Select value={fill.src ? 'image' : fill.pattern} onChange={async (v) => {
            if (v === 'image') {
              const f = await pickFile('image/*')
              if (!f) return
              const { src } = await fileToDataUrl(f, 1600)
              onChange({ ...fill, pattern: 'image', src, scale: 1 })
            } else onChange({ ...fill, pattern: v, src: undefined })
          }} options={PATTERNS.map((p) => ({ value: p, label: p === 'image' ? 'Image fill (upload)…' : p[0].toUpperCase() + p.slice(1) }))} />
          {!fill.src && (
            <div className="flex gap-1.5">
              <ColorInput className="flex-1" value={fill.colors?.[0] ?? '#14141f'} onChange={(c) => onChange({ ...fill, colors: [c, fill.colors?.[1] ?? '#7c5cff'] }, 'pc0')} />
              <ColorInput className="flex-1" value={fill.colors?.[1] ?? '#7c5cff'} onChange={(c) => onChange({ ...fill, colors: [fill.colors?.[0] ?? '#14141f', c] }, 'pc1')} />
            </div>
          )}
          <Slider label="Scale" value={fill.scale} min={0.1} max={4} step={0.05} onChange={(v) => onChange({ ...fill, scale: v }, 'pscale')} />
        </>
      )}
    </div>
  )
}
