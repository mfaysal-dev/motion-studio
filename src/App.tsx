import { useEffect, useRef, useState } from 'react'
import { useStore, actions, getState, type Tool } from './store'
import { TopBar } from './components/TopBar'
import { Toolbar } from './components/Toolbar'
import { LeftPanel } from './components/LeftPanel'
import { Stage } from './components/Stage'
import { Inspector } from './components/Inspector'
import { Timeline } from './components/Timeline'
import { Modals } from './components/Modals'
import { loadProject, lastProjectId, saveProject } from './lib/persist'
import { normalizeProject } from './core/elements'
import { TEMPLATES } from './core/templates'
import { thumbnail } from './lib/exporters'
import { addImageFile, pickFile } from './lib/upload'

const TOOL_KEYS: Record<string, Tool> = { v: 'select', h: 'hand', t: 'text', r: 'rect', o: 'ellipse', u: 'polygon', s: 'star', l: 'line', a: 'arrow', p: 'pen', b: 'brush', e: 'eraser' }

export default function App() {
  const theme = useStore((s) => s.theme)
  const toast = useStore((s) => s.toast)
  const [ready, setReady] = useState(false)
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'idle'>('idle')
  const [leftOpen, setLeftOpen] = useState(false)
  const [rightOpen, setRightOpen] = useState(false)

  useEffect(() => { document.documentElement.dataset.theme = theme }, [theme])

  // load last project or a showcase template
  useEffect(() => {
    (async () => {
      const params = new URLSearchParams(location.search)
      const tpl = params.get('template')
      const id = lastProjectId()
      let p = tpl ? TEMPLATES.find((t) => t.id === tpl)?.build() : undefined
      if (!p && id) { try { const raw = await loadProject(id); if (raw) p = normalizeProject(raw) } catch { /* ignore */ } }
      if (!p) p = TEMPLATES[0].build()
      actions.setProject(p)
      const sel = params.get('select')
      if (sel === 'first-text') { const t = getState().project.elements.find((e) => e.type === 'text'); if (t) actions.select([t.id]) }
      const tab = params.get('tab')
      if (tab === 'animate') useStore.setState({ rightTab: 'animate' })
      const at = params.get('t')
      if (at) actions.setTime(parseFloat(at))
      setReady(true)
    })()
  }, [])

  // autosave (debounced)
  const project = useStore((s) => s.project)
  const first = useRef(true)
  useEffect(() => {
    if (!ready) return
    if (first.current) { first.current = false; return }
    setSaveState('saving')
    const id = setTimeout(async () => {
      try { await saveProject(project, thumbnail(project)); setSaveState('saved') } catch { setSaveState('idle'); actions.toast('Could not save (storage full?) — export JSON to keep a copy') }
    }, 900)
    return () => clearTimeout(id)
  }, [project, ready])

  // playback loop
  const playing = useStore((s) => s.playing)
  useEffect(() => {
    if (!playing) return
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      const s = getState()
      let t = s.time + dt
      if (t >= s.project.duration) {
        if (s.loopPlayback) t = t % s.project.duration
        else { useStore.setState({ time: s.project.duration, playing: false }); return }
      }
      useStore.setState({ time: t })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing])

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return
      const s = getState()
      const mod = e.metaKey || e.ctrlKey
      const k = e.key.toLowerCase()
      if (s.modal) { if (e.key === 'Escape') useStore.setState({ modal: null }); return }
      if (mod && k === 'z') { e.preventDefault(); if (e.shiftKey) actions.redo(); else actions.undo(); return }
      if (mod && k === 'y') { e.preventDefault(); actions.redo(); return }
      if (mod && k === 'c') { e.preventDefault(); actions.copy(); return }
      if (mod && k === 'x') { e.preventDefault(); actions.cut(); return }
      if (mod && k === 'v') { e.preventDefault(); actions.paste(); return }
      if (mod && k === 'd') { e.preventDefault(); actions.duplicate(); return }
      if (mod && k === 'a') { e.preventDefault(); actions.selectAll(); return }
      if (mod && k === 'g') { e.preventDefault(); if (e.shiftKey) actions.ungroup(); else actions.group(); return }
      if (mod && e.key === ']') { e.preventDefault(); actions.reorder(e.shiftKey ? 'top' : 'up'); return }
      if (mod && e.key === '[') { e.preventDefault(); actions.reorder(e.shiftKey ? 'bottom' : 'down'); return }
      if (mod && (e.key === '=' || e.key === '+')) { e.preventDefault(); actions.zoomAt(s.zoom * 1.25); return }
      if (mod && e.key === '-') { e.preventDefault(); actions.zoomAt(s.zoom / 1.25); return }
      if (mod && e.key === '0') { e.preventDefault(); actions.zoomAt(1); return }
      if (mod && k === 's') { e.preventDefault(); saveProject(s.project, thumbnail(s.project)).then(() => actions.toast('Saved to this browser')); return }
      if (mod && k === 'e') { e.preventDefault(); useStore.setState({ modal: 'export' }); return }
      if (mod) return
      if (e.shiftKey && e.code === 'Digit1') { actions.fitView(); return }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); actions.deleteSelection(); return }
      if (e.key === 'Escape') { if (s.tool !== 'select') useStore.setState({ tool: 'select' }); else actions.select([]); return }
      if (e.key === 'Enter') { const el = s.project.elements.find((x) => x.id === s.selection[0]); if (el?.type === 'text') { e.preventDefault(); useStore.setState({ editingTextId: el.id }) } return }
      if (e.key.startsWith('Arrow') && s.selection.length) {
        e.preventDefault()
        const d = e.shiftKey ? 10 : 1
        actions.nudge(e.key === 'ArrowLeft' ? -d : e.key === 'ArrowRight' ? d : 0, e.key === 'ArrowUp' ? -d : e.key === 'ArrowDown' ? d : 0)
        return
      }
      if (e.key === '?') { useStore.setState({ modal: 'shortcuts' }); return }
      if (e.key === ',' || e.key === '.') { actions.pause(); actions.setTime(s.time + (e.key === '.' ? 1 / 30 : -1 / 30)); return }
      if (k === 'k' && s.selection.length === 1) { actions.addKeyframe(s.selection[0]); return }
      if (k === 'i') { pickFile('image/*').then((f) => f && addImageFile(f)); return }
      const tool = TOOL_KEYS[k]
      if (tool) useStore.setState({ tool, leftTab: tool === 'brush' || tool === 'eraser' || tool === 'pen' ? 'draw' : s.leftTab })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // paste images from clipboard / drop files on window
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const f = [...(e.clipboardData?.files ?? [])].find((x) => x.type.startsWith('image/'))
      if (f) { e.preventDefault(); addImageFile(f) }
    }
    const onDrop = (e: DragEvent) => {
      const f = [...(e.dataTransfer?.files ?? [])][0]
      if (!f) return
      e.preventDefault()
      if (f.type.startsWith('image/')) addImageFile(f)
    }
    const onOver = (e: DragEvent) => { if (e.dataTransfer?.types.includes('Files')) e.preventDefault() }
    window.addEventListener('paste', onPaste)
    window.addEventListener('drop', onDrop)
    window.addEventListener('dragover', onOver)
    return () => { window.removeEventListener('paste', onPaste); window.removeEventListener('drop', onDrop); window.removeEventListener('dragover', onOver) }
  }, [])

  return (
    <div className="h-full flex flex-col">
      <TopBar saveState={saveState} onToggleLeft={() => setLeftOpen(!leftOpen)} onToggleRight={() => setRightOpen(!rightOpen)} />
      <div className="flex-1 min-h-0 flex relative">
        <Toolbar />
        <div className={`contents ${leftOpen ? 'max-lg:[&>div]:!flex max-lg:[&>div]:absolute max-lg:[&>div]:left-[52px] max-lg:[&>div]:top-0 max-lg:[&>div]:bottom-0 max-lg:[&>div]:z-30 max-lg:[&>div]:shadow-2xl' : ''}`}><LeftPanel /></div>
        <div className="flex-1 min-w-0 flex flex-col">
          <Stage />
          <Timeline />
        </div>
        <div className={`contents ${rightOpen ? 'max-md:[&>div]:!flex max-md:[&>div]:absolute max-md:[&>div]:right-0 max-md:[&>div]:top-0 max-md:[&>div]:bottom-0 max-md:[&>div]:z-30 max-md:[&>div]:shadow-2xl' : ''}`}><Inspector /></div>
      </div>
      <Modals />
      {toast && <div key={toast.id} className="toast fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-xl bg-panel3 border border-line text-[12.5px] font-medium" style={{ boxShadow: 'var(--shadow)' }}>{toast.msg}</div>}
    </div>
  )
}
