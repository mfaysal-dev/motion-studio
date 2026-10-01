import { useEffect, useRef, useState } from 'react'
import { Play, Pause, SkipBack, Repeat, ChevronDown, ChevronUp, Diamond, PenLine, Clapperboard } from 'lucide-react'
import { useStore, actions } from '../store'
import type { DesignElement, TextElement } from '../core/types'
import { NumberInput } from './ui'
import { presetInfo } from '../core/animate'

const ROW = 30
const LEFT = typeof window !== 'undefined' && window.innerWidth < 1100 ? 132 : 176

export function Timeline() {
  const open = useStore((s) => s.timelineOpen)
  const playing = useStore((s) => s.playing)
  const time = useStore((s) => s.time)
  const duration = useStore((s) => s.project.duration)
  const loop = useStore((s) => s.loopPlayback)
  const designView = useStore((s) => s.designView)
  const elements = useStore((s) => s.project.elements)
  const selection = useStore((s) => s.selection)
  const trackRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(600)

  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [open])

  const pps = Math.max(10, (width - 16) / duration)
  const xOf = (t: number) => 8 + t * pps
  const tOf = (x: number) => Math.max(0, Math.min(duration, (x - 8) / pps))
  const snapT = (t: number) => Math.round(t * 20) / 20

  const scrub = (e: React.PointerEvent) => {
    const r = trackRef.current!.getBoundingClientRect()
    const move = (ev: PointerEvent) => actions.setTime(tOf(ev.clientX - r.left))
    if (playing) actions.pause()
    actions.setTime(tOf(e.clientX - r.left))
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', () => window.removeEventListener('pointermove', move), { once: true })
  }

  const dragBar = (e: React.PointerEvent, el: DesignElement, mode: 'move' | 'start' | 'end') => {
    e.stopPropagation()
    if (el.locked) return
    actions.select([el.id], e.shiftKey ? 'add' : selection.includes(el.id) ? 'add' : 'replace')
    const x0 = e.clientX
    const s0 = el.anim.start, e0 = el.anim.end
    actions.begin()
    const move = (ev: PointerEvent) => {
      const dt = (ev.clientX - x0) / pps
      actions.live((p) => {
        const d = p.elements.find((x) => x.id === el.id)
        if (!d) return
        if (mode === 'move') {
          const len = e0 - s0
          const ns = snapT(Math.max(0, Math.min(duration - len, s0 + dt)))
          d.anim.start = ns; d.anim.end = ns + len
        } else if (mode === 'start') d.anim.start = snapT(Math.max(0, Math.min(e0 - 0.2, s0 + dt)))
        else d.anim.end = snapT(Math.max(s0 + 0.2, Math.min(duration, e0 + dt)))
      })
    }
    const up = () => { window.removeEventListener('pointermove', move); actions.end() }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up, { once: true })
  }

  const rows = [...elements].reverse()
  const ticks: number[] = []
  const step = duration > 30 ? 5 : duration > 12 ? 2 : duration > 5 ? 1 : 0.5
  for (let t = 0; t <= duration + 1e-6; t += step) ticks.push(Math.round(t * 100) / 100)

  return (
    <div className="bg-panel border-t border-line shrink-0 flex flex-col" style={{ height: open ? 236 : 46 }}>
      <div className="h-[46px] shrink-0 flex items-center gap-2 px-3 border-b border-line">
        <button className="icon-btn" title="Back to start" onClick={() => actions.setTime(0)}><SkipBack size={15} /></button>
        <button className="shrink-0 w-9 h-9 rounded-full grad-bg grid place-items-center text-white shadow-lg hover:brightness-110 transition" title="Play / pause (Space)" onClick={actions.togglePlay}>
          {playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
        </button>
        <div className="font-mono tabular-nums text-[12.5px] w-[108px] shrink-0 whitespace-nowrap"><span className="text-ink">{time.toFixed(2)}</span><span className="text-muted"> / {duration.toFixed(2)}s</span></div>
        <button className={`icon-btn ${loop ? 'on' : ''}`} title="Loop playback" onClick={() => useStore.setState({ loopPlayback: !loop })}><Repeat size={14} /></button>
        <div className="h-5 w-px bg-line mx-1" />
        <div className="flex bg-panel2 border border-line rounded-[9px] p-[2px]">
          <button className={`h-[26px] px-2.5 rounded-[7px] text-[12px] flex items-center gap-1.5 ${designView ? 'bg-panel3 text-ink' : 'text-muted'}`} onClick={() => actions.setDesignView(true)} title="Edit the static design (animations paused)"><PenLine size={13} /><span className="max-lg:hidden">Design</span></button>
          <button className={`h-[26px] px-2.5 rounded-[7px] text-[12px] flex items-center gap-1.5 ${!designView ? 'bg-panel3 text-ink' : 'text-muted'}`} onClick={() => actions.setDesignView(false)} title="See motion at the playhead"><Clapperboard size={13} /><span className="max-lg:hidden">Motion</span></button>
        </div>
        <div className="flex-1" />
        <span className="text-muted text-[12px] max-lg:hidden">Scene</span>
        <NumberInput className="w-[78px]" value={duration} step={0.5} min={1} max={120} suffix="s" onChange={actions.setDuration} />
        <button className="icon-btn" title={open ? 'Collapse timeline' : 'Expand timeline'} onClick={() => useStore.setState({ timelineOpen: !open })}>{open ? <ChevronDown size={15} /> : <ChevronUp size={15} />}</button>
      </div>
      {open && (
        <div className="flex-1 min-h-0 flex overflow-hidden">
          <div className="shrink-0 border-r border-line overflow-hidden" style={{ width: LEFT }}>
            <div className="h-6 border-b border-line text-[10.5px] uppercase tracking-wider text-muted px-3 flex items-center">Layers</div>
            <div className="overflow-y-auto" style={{ height: 'calc(100% - 24px)' }} id="tl-names" onScroll={(e) => { const t = document.getElementById('tl-tracks'); if (t) t.scrollTop = (e.target as HTMLElement).scrollTop }}>
              {rows.map((el) => (
                <div key={el.id} onClick={(e) => actions.select([el.id], e.shiftKey ? 'toggle' : 'replace')}
                  className={`flex items-center px-3 text-[12px] truncate cursor-default border-b border-line/50 ${selection.includes(el.id) ? 'text-ink bg-hover' : 'text-muted'}`} style={{ height: ROW }}>
                  <span className="truncate">{el.type === 'text' ? (el as TextElement).text.split('\n')[0] : el.name}</span>
                </div>
              ))}
              {!rows.length && <div className="p-3 text-[12px] text-muted">Add layers to animate.</div>}
            </div>
          </div>
          <div ref={trackRef} className="relative flex-1 min-w-0 overflow-hidden">
            <div className="h-6 border-b border-line relative cursor-ew-resize select-none" onPointerDown={scrub}>
              {ticks.map((t) => (
                <div key={t} className="absolute top-0 h-full text-[10px] text-muted font-mono" style={{ left: xOf(t) }}>
                  <div className="w-px h-2 bg-line" />
                  <span className="absolute top-2 -translate-x-1/2">{t}s</span>
                </div>
              ))}
            </div>
            <div id="tl-tracks" className="overflow-y-auto relative" style={{ height: 'calc(100% - 24px)' }} onPointerDown={scrub}
              onScroll={(e) => { const n = document.getElementById('tl-names'); if (n) n.scrollTop = (e.target as HTMLElement).scrollTop }}>
              {rows.map((el) => <TrackRow key={el.id} el={el} xOf={xOf} selected={selection.includes(el.id)} onBar={dragBar} />)}
            </div>
            <div className="absolute top-0 bottom-0 pointer-events-none" style={{ left: xOf(time) }}>
              <div className="absolute top-0 -translate-x-1/2 w-3 h-3 rotate-45 rounded-[2px] bg-accent2" style={{ top: 4 }} />
              <div className="absolute top-0 bottom-0 w-px bg-accent2 shadow-[0_0_8px_var(--accent-2)]" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TrackRow({ el, xOf, selected, onBar }: { el: DesignElement; xOf: (t: number) => number; selected: boolean; onBar: (e: React.PointerEvent, el: DesignElement, mode: 'move' | 'start' | 'end') => void }) {
  const a = el.anim
  const x0 = xOf(a.start), x1 = xOf(a.end)
  const enterW = a.enter ? Math.min(x1 - x0, xOf(a.start + a.enter.delay + a.enter.duration) - x0) : 0
  const enterOff = a.enter ? xOf(a.start + a.enter.delay) - x0 : 0
  const exitW = a.exit ? Math.min(x1 - x0, xOf(a.exit.duration) - xOf(0)) : 0
  const kfTimes = [...new Set(Object.values(a.keyframes).flatMap((tr) => (tr ?? []).map((k) => Math.round(k.t * 1000) / 1000)))]
  return (
    <div className="relative border-b border-line/50" style={{ height: ROW }}>
      <div
        className={`absolute top-[5px] bottom-[5px] rounded-[7px] overflow-hidden cursor-grab active:cursor-grabbing border ${selected ? 'border-accent' : 'border-transparent'}`}
        style={{ left: x0, width: Math.max(6, x1 - x0), background: selected ? 'color-mix(in oklab, var(--accent) 34%, var(--panel-3))' : 'var(--panel-3)' }}
        onPointerDown={(e) => onBar(e, el, 'move')}
        title={`${el.name}: ${a.start.toFixed(2)}s → ${a.end.toFixed(2)}s`}
      >
        {a.emphasis && <div className="absolute inset-0 opacity-30" style={{ background: 'repeating-linear-gradient(135deg, var(--accent-2) 0 4px, transparent 4px 9px)' }} title={presetInfo('emphasis', a.emphasis.preset)?.name} />}
        {a.enter && <div className="absolute top-0 bottom-0 rounded-l-[6px]" style={{ left: enterOff, width: Math.max(3, enterW - enterOff), background: 'linear-gradient(90deg, var(--accent), color-mix(in oklab, var(--accent) 30%, transparent))' }} />}
        {a.exit && <div className="absolute top-0 bottom-0 right-0" style={{ width: Math.max(3, exitW), background: 'linear-gradient(270deg, #ff4f8b, transparent)' }} />}
        <div className="absolute inset-0 flex items-center px-2 text-[10.5px] text-ink/85 pointer-events-none truncate font-medium gap-1">
          {a.enter && <span>{presetInfo('enter', a.enter.preset)?.name}</span>}
          {a.emphasis && <span className="opacity-80">· {presetInfo('emphasis', a.emphasis.preset)?.name}</span>}
        </div>
        <div className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize" onPointerDown={(e) => onBar(e, el, 'start')} />
        <div className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize" onPointerDown={(e) => onBar(e, el, 'end')} />
      </div>
      {kfTimes.map((t) => (
        <button key={t} className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 text-accent2 hover:scale-125 transition-transform" style={{ left: xOf(t) }}
          onPointerDown={(e) => { e.stopPropagation(); actions.setTime(t); actions.select([el.id]) }} title={`Keyframe ${t.toFixed(2)}s`}>
          <Diamond size={11} fill="currentColor" />
        </button>
      ))}
    </div>
  )
}
