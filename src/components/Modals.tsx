import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, FileJson, Upload, Trash2, Plus, Film, Image as ImageIcon, Clapperboard } from 'lucide-react'
import { useStore, actions } from '../store'
import { importProjectFile } from '../lib/io'
import { Modal, Segmented, Toggle, Row } from './ui'
import { TEMPLATES } from '../core/templates'
import { ARTBOARD_PRESETS, emptyProject, normalizeProject } from '../core/elements'
import { download, exportGif, exportImage, exportSVG, recordVideo, renderFrame, safeName, pickVideoMime } from '../lib/exporters'
import { deleteProject, listProjects, loadProject, type ProjectMeta } from '../lib/persist'

export function Modals() {
  const modal = useStore((s) => s.modal)
  const close = () => useStore.setState({ modal: null })
  if (!modal) return null
  if (modal === 'export') return <ExportModal onClose={close} />
  if (modal === 'templates') return <TemplatesModal onClose={close} />
  if (modal === 'projects') return <ProjectsModal onClose={close} />
  return <ShortcutsModal onClose={close} />
}

function ExportModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'image' | 'video' | 'gif' | 'project'>('image')
  const [fmt, setFmt] = useState<'png' | 'jpeg' | 'svg'>('png')
  const [scale, setScale] = useState('1')
  const [frame, setFrame] = useState<'design' | 'current'>('design')
  const [transparent, setTransparent] = useState(false)
  const [vscale, setVscale] = useState('1')
  const [fps, setFps] = useState('30')
  const [gifSize, setGifSize] = useState('480')
  const [gifFps, setGifFps] = useState('15')
  const [busy, setBusy] = useState<number | null>(null)
  const abort = useRef<AbortController | null>(null)
  const project = useStore((s) => s.project)
  const time = useStore((s) => s.time)
  const name = safeName(project.name)
  const video = pickVideoMime()
  const maxVideoScale = Math.min(1, 1920 / Math.max(project.artboard.width, project.artboard.height))

  const run = async (fn: (signal: AbortSignal) => Promise<void>) => {
    abort.current = new AbortController()
    setBusy(0)
    try { await fn(abort.current.signal) } catch (e) { if ((e as Error).message !== 'cancelled') actions.toast((e as Error).message || 'Export failed') }
    setBusy(null)
  }

  const doImage = () => run(async () => {
    const t = frame === 'current' ? time : 0
    if (fmt === 'svg') { download(new Blob([exportSVG(project, t)], { type: 'image/svg+xml' }), `${name}.svg`); actions.toast('SVG exported'); return }
    const blob = await exportImage(project, fmt, parseFloat(scale), t, frame === 'current', transparent)
    download(blob, `${name}${scale !== '1' ? `@${scale}x` : ''}.${fmt === 'jpeg' ? 'jpg' : 'png'}`)
    actions.toast(`${fmt.toUpperCase()} exported`)
  })
  const doVideo = () => run(async (signal) => {
    const s = Math.min(maxVideoScale, parseFloat(vscale))
    const { blob, ext } = await recordVideo(project, { scale: s, fps: parseInt(fps), bitrate: 8_000_000, onProgress: (p) => setBusy(p), signal })
    download(blob, `${name}.${ext}`)
    actions.toast(`${ext.toUpperCase()} video exported`)
  })
  const doGif = () => run(async (signal) => {
    const blob = await exportGif(project, { maxSize: parseInt(gifSize), fps: parseInt(gifFps), onProgress: (p) => setBusy(p), signal })
    download(blob, `${name}.gif`)
    actions.toast('GIF exported')
  })

  return (
    <Modal title="Export" onClose={() => { abort.current?.abort(); onClose() }} width={560}>
      <div className="p-5 space-y-5">
        <div className="grid grid-cols-4 gap-2">
          {([['image', ImageIcon, 'Image'], ['video', Film, 'Video'], ['gif', Clapperboard, 'GIF'], ['project', FileJson, 'Project']] as const).map(([id, Icon, label]) => (
            <button key={id} onClick={() => setTab(id)} className={`h-[68px] rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-colors ${tab === id ? 'border-accent bg-[color-mix(in_oklab,var(--accent)_14%,transparent)]' : 'border-line bg-panel2 hover:border-accent'}`}>
              <Icon size={18} /><span className="text-[12px] font-medium">{label}</span>
            </button>
          ))}
        </div>
        {tab === 'image' && (
          <div className="space-y-3">
            <Row label="Format"><Segmented value={fmt} onChange={setFmt} options={[{ value: 'png', label: 'PNG' }, { value: 'jpeg', label: 'JPG' }, { value: 'svg', label: 'SVG' }]} /></Row>
            {fmt !== 'svg' && <Row label="Scale"><Segmented value={scale} onChange={setScale} options={['0.5', '1', '2', '3'].map((v) => ({ value: v, label: `${v}×` }))} /></Row>}
            <Row label="Frame"><Segmented value={frame} onChange={setFrame} options={[{ value: 'design', label: 'Static design' }, { value: 'current', label: `Frame @ ${time.toFixed(2)}s` }]} /></Row>
            {fmt === 'png' && <Row label="Transparent"><Toggle checked={transparent} onChange={setTransparent} /></Row>}
            <p className="text-[12px] text-muted">{fmt === 'svg' ? 'Vector SVG with live text, gradients, shadows & glows. Eraser strokes and patterns are simplified.' : `Output: ${Math.round(project.artboard.width * parseFloat(scale))} × ${Math.round(project.artboard.height * parseFloat(scale))} px`}</p>
            <button className="btn-primary w-full justify-center h-10" disabled={busy !== null} onClick={doImage}><Download size={15} />Download {fmt === 'jpeg' ? 'JPG' : fmt.toUpperCase()}</button>
          </div>
        )}
        {tab === 'video' && (
          <div className="space-y-3">
            {!video && <p className="text-[12px] text-[#ff7a90]">Your browser doesn't support MediaRecorder canvas capture. Try Chrome, Edge or Firefox.</p>}
            <Row label="Resolution"><Segmented value={vscale} onChange={setVscale} options={[{ value: '0.5', label: `${Math.round(project.artboard.width * Math.min(maxVideoScale, 0.5))}p wide` }, { value: '1', label: `${Math.round(project.artboard.width * maxVideoScale)} × ${Math.round(project.artboard.height * maxVideoScale)}` }]} /></Row>
            <Row label="FPS"><Segmented value={fps} onChange={setFps} options={[{ value: '24', label: '24' }, { value: '30', label: '30' }, { value: '60', label: '60' }]} /></Row>
            <p className="text-[12px] text-muted">Records the {project.duration}s scene in real time as {video?.ext.toUpperCase() ?? 'WebM'} ({video?.mime ?? 'n/a'}). Keep this tab visible while recording.</p>
            <Progress busy={busy} />
            {busy === null ? <button className="btn-primary w-full justify-center h-10" disabled={!video} onClick={doVideo}><Film size={15} />Record {video?.ext.toUpperCase() ?? 'video'}</button> : <button className="btn w-full justify-center h-10" onClick={() => abort.current?.abort()}>Cancel</button>}
          </div>
        )}
        {tab === 'gif' && (
          <div className="space-y-3">
            <Row label="Max size"><Segmented value={gifSize} onChange={setGifSize} options={['320', '480', '720'].map((v) => ({ value: v, label: `${v}px` }))} /></Row>
            <Row label="FPS"><Segmented value={gifFps} onChange={setGifFps} options={['10', '15', '20'].map((v) => ({ value: v, label: v }))} /></Row>
            <p className="text-[12px] text-muted">Renders {Math.round(project.duration * parseInt(gifFps))} frames offline with a 256-color palette per frame. Glows & gradients may band slightly.</p>
            <Progress busy={busy} />
            {busy === null ? <button className="btn-primary w-full justify-center h-10" onClick={doGif}><Clapperboard size={15} />Render GIF</button> : <button className="btn w-full justify-center h-10" onClick={() => abort.current?.abort()}>Cancel</button>}
          </div>
        )}
        {tab === 'project' && <ProjectIO onDone={onClose} />}
      </div>
    </Modal>
  )
}

function Progress({ busy }: { busy: number | null }) {
  if (busy === null) return null
  return (
    <div>
      <div className="h-2 rounded-full bg-panel3 overflow-hidden"><div className="h-full grad-bg transition-[width]" style={{ width: `${Math.round(busy * 100)}%` }} /></div>
      <div className="text-[11px] text-muted mt-1 tabular-nums">{Math.round(busy * 100)}%</div>
    </div>
  )
}

function ProjectIO({ onDone }: { onDone: () => void }) {
  const project = useStore((s) => s.project)
  return (
    <div className="space-y-3">
      <p className="text-[12px] text-muted">Projects auto-save in this browser (IndexedDB). Export a <span className="kbd">.kinetica.json</span> file to back up or move a design to another device — images are embedded.</p>
      <button className="btn-primary w-full justify-center h-10" onClick={() => { download(new Blob([JSON.stringify(project, null, 1)], { type: 'application/json' }), `${safeName(project.name)}.kinetica.json`); actions.toast('Project file exported') }}><FileJson size={15} />Export project JSON</button>
      <button className="btn w-full justify-center h-10" onClick={async () => { if (await importProjectFile()) onDone() }}><Upload size={15} />Import project JSON</button>
    </div>
  )
}

function TemplatesModal({ onClose }: { onClose: () => void }) {
  const thumbs = useMemo(() => TEMPLATES.map((t) => {
    const p = t.build()
    try { return renderFrame(p, { time: p.duration * 0.55, animate: true, scale: 300 / Math.max(p.artboard.width, p.artboard.height) }).toDataURL('image/jpeg', 0.8) } catch { return '' }
  }), [])
  const [, setTick] = useState(0)
  useEffect(() => { const id = setTimeout(() => setTick(1), 900); return () => clearTimeout(id) }, [])
  return (
    <Modal title="Templates" onClose={onClose} width={900}>
      <div className="p-5">
        <p className="text-[12.5px] text-muted mb-4">Every template is fully animated and editable. Opening one creates a new project — your current work stays saved.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {TEMPLATES.map((t, i) => (
            <button key={t.id} className="group text-left rounded-2xl border border-line hover:border-accent bg-panel2 p-2 transition-colors" onClick={() => { const p = t.build(); actions.setProject(p); onClose(); setTimeout(() => { actions.setTime(0); actions.play() }, 150) }}>
              <div className="aspect-square rounded-xl overflow-hidden bg-black grid place-items-center">
                {thumbs[i] ? <img src={thumbs[i]} alt="" className="max-w-full max-h-full group-hover:scale-[1.03] transition-transform" /> : null}
              </div>
              <div className="px-1 pt-2 pb-1">
                <div className="font-semibold text-[13px]">{t.name}</div>
                <div className="text-[11px] text-muted">{t.size}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  )
}

function ProjectsModal({ onClose }: { onClose: () => void }) {
  const [list, setList] = useState<ProjectMeta[] | null>(null)
  const current = useStore((s) => s.project.id)
  const refresh = () => listProjects().then(setList)
  useEffect(() => { refresh() }, [])
  return (
    <Modal title="Projects" onClose={onClose} width={860}>
      <div className="p-5 space-y-5">
        <div>
          <div className="section-title mb-2">New design</div>
          <div className="flex flex-wrap gap-2">
            {ARTBOARD_PRESETS.slice(0, 8).map((p) => (
              <button key={p.id} className="btn" onClick={() => { actions.setProject(emptyProject(p.w, p.h, p.name)); onClose() }}><Plus size={13} />{p.name}<span className="text-muted text-[11px]">{p.w}×{p.h}</span></button>
            ))}
            <button className="btn" onClick={async () => { if (await importProjectFile()) onClose() }}><Upload size={13} />Import JSON</button>
          </div>
        </div>
        <div>
          <div className="section-title mb-2">Saved in this browser</div>
          {!list ? <div className="text-muted text-[12px]">Loading…</div> : !list.length ? <div className="text-muted text-[12px]">Nothing saved yet.</div> : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {list.map((m) => (
                <div key={m.id} className={`group rounded-2xl border bg-panel2 p-2 ${m.id === current ? 'border-accent' : 'border-line hover:border-accent'}`}>
                  <button className="block w-full" onClick={async () => { const p = await loadProject(m.id); if (p) { actions.setProject(normalizeProject(p)); onClose() } else actions.toast('Could not open project') }}>
                    <div className="aspect-[4/3] rounded-xl overflow-hidden bg-black grid place-items-center">{m.thumb && <img src={m.thumb} alt="" className="max-w-full max-h-full" />}</div>
                  </button>
                  <div className="flex items-center gap-1 px-1 pt-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-[12.5px] truncate">{m.name}</div>
                      <div className="text-[10.5px] text-muted">{m.w}×{m.h} · {new Date(m.updatedAt).toLocaleDateString()}</div>
                    </div>
                    {m.id !== current && <button className="icon-btn !h-7 !min-w-7 !p-0 opacity-0 group-hover:opacity-100" title="Delete from this browser" onClick={async () => { if (confirm(`Delete “${m.name}” from this browser?`)) { await deleteProject(m.id); refresh() } }}><Trash2 size={13} /></button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

const SHORTCUTS: [string, string][] = [
  ['V / H', 'Select / Hand'], ['T', 'Text'], ['R O U S', 'Rect · Ellipse · Polygon · Star'], ['L / A', 'Line / Arrow'], ['P', 'Pen (Enter finishes, click start point to close)'], ['B / E', 'Brush / Eraser'], ['I', 'Upload image'],
  ['Space', 'Tap: play/pause · Hold + drag: pan'], ['Ctrl + wheel / pinch', 'Zoom'], ['Shift + 1 / Ctrl + 0', 'Fit / 100%'],
  ['Ctrl + Z / Ctrl + Shift + Z', 'Undo / Redo'], ['Ctrl + C / V / X / D', 'Copy / Paste / Cut / Duplicate'], ['Ctrl + A', 'Select all'], ['Ctrl + G / Ctrl + Shift + G', 'Group / Ungroup'],
  ['Ctrl + ] / [', 'Bring forward / Send backward'], ['Delete', 'Delete selection'], ['Arrows (+Shift)', 'Nudge 1px (10px)'], ['Shift while dragging', 'Constrain / keep ratio / snap 15°'], ['Alt while dragging', 'Disable snapping'],
  ['Enter / double-click', 'Edit text'], ['K', 'Add keyframe at playhead'], [', / .', 'Step playhead −/+ 1 frame'], ['Esc', 'Deselect / exit'],
]

function ShortcutsModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Keyboard shortcuts" onClose={onClose} width={620}>
      <div className="p-5 grid sm:grid-cols-2 gap-x-6 gap-y-2">
        {SHORTCUTS.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-3 py-1 border-b border-line/60">
            <span className="text-[12.5px]">{v}</span>
            <span className="kbd shrink-0">{k}</span>
          </div>
        ))}
      </div>
    </Modal>
  )
}

