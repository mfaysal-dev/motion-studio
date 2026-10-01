import { Undo2, Redo2, Minus, Plus, Maximize, Sun, Moon, Keyboard, Download, LayoutTemplate, FolderOpen, PanelLeft, PanelRight, Check, Loader2 } from 'lucide-react'
import { useStore, actions } from '../store'

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#8b6cff" /><stop offset="1" stopColor="#22d3ee" /></linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="9" fill="url(#lg)" />
      <path d="M10 8v16M10 16l9-8M13.5 13l7.5 11" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="23.5" cy="9.5" r="2" fill="#fff" />
    </svg>
  )
}

export function TopBar({ saveState, onToggleLeft, onToggleRight }: { saveState: 'saved' | 'saving' | 'idle'; onToggleLeft: () => void; onToggleRight: () => void }) {
  const name = useStore((s) => s.project.name)
  const zoom = useStore((s) => s.zoom)
  const theme = useStore((s) => s.theme)
  const canUndo = useStore((s) => s.canUndo)
  const canRedo = useStore((s) => s.canRedo)
  return (
    <header className="h-[52px] shrink-0 bg-panel border-b border-line flex items-center gap-2 px-3 relative z-20">
      <button className="icon-btn lg:hidden" onClick={onToggleLeft} aria-label="Toggle left panel"><PanelLeft size={16} /></button>
      <div className="flex items-center gap-2 pr-2">
        <Logo />
        <div className="leading-none max-sm:hidden">
          <div className="font-display font-extrabold text-[16px] tracking-tight">Kinetica</div>
          <div className="text-[9.5px] uppercase tracking-[0.18em] text-muted mt-0.5">Design · Motion</div>
        </div>
      </div>
      <div className="h-6 w-px bg-line" />
      <button className="icon-btn" onClick={() => useStore.setState({ modal: 'projects' })} title="Projects"><FolderOpen size={15} /><span className="max-lg:hidden">Projects</span></button>
      <button className="icon-btn" onClick={() => useStore.setState({ modal: 'templates' })} title="Templates"><LayoutTemplate size={15} /><span className="max-lg:hidden">Templates</span></button>
      <div className="flex-1 flex justify-center min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <input className="bg-transparent text-center font-semibold outline-none rounded-md px-2 h-8 hover:bg-hover focus:bg-panel2 min-w-0 w-[220px] max-lg:w-[150px]" value={name}
            onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
            onChange={(e) => actions.commit((d) => { d.name = e.target.value }, 'name')} aria-label="Project name" />
          <span className="text-muted text-[11px] flex items-center gap-1 w-14 max-lg:hidden">
            {saveState === 'saving' ? <><Loader2 size={11} className="animate-spin" />Saving</> : saveState === 'saved' ? <><Check size={11} />Saved</> : null}
          </span>
        </div>
      </div>
      <button className="icon-btn" disabled={!canUndo} onClick={actions.undo} title="Undo (Ctrl+Z)"><Undo2 size={16} /></button>
      <button className="icon-btn" disabled={!canRedo} onClick={actions.redo} title="Redo (Ctrl+Shift+Z)"><Redo2 size={16} /></button>
      <div className="h-6 w-px bg-line" />
      <div className="flex items-center max-sm:hidden">
        <button className="icon-btn" onClick={() => actions.zoomAt(zoom / 1.25)} title="Zoom out (Ctrl -)"><Minus size={14} /></button>
        <button className="icon-btn w-[54px] tabular-nums text-[12px]" onClick={() => actions.zoomAt(1)} title="Zoom to 100%">{Math.round(zoom * 100)}%</button>
        <button className="icon-btn" onClick={() => actions.zoomAt(zoom * 1.25)} title="Zoom in (Ctrl +)"><Plus size={14} /></button>
        <button className="icon-btn" onClick={actions.fitView} title="Fit to screen (Shift+1)"><Maximize size={14} /></button>
      </div>
      <button className="icon-btn" onClick={() => actions.setTheme(theme === 'dark' ? 'light' : 'dark')} title="Toggle theme">{theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}</button>
      <button className="icon-btn max-sm:hidden" onClick={() => useStore.setState({ modal: 'shortcuts' })} title="Keyboard shortcuts (?)"><Keyboard size={15} /></button>
      <button className="icon-btn md:hidden" onClick={onToggleRight} aria-label="Toggle inspector"><PanelRight size={16} /></button>
      <button className="btn-primary ml-1" onClick={() => useStore.setState({ modal: 'export' })}><Download size={15} /><span className="max-sm:hidden">Export</span></button>
    </header>
  )
}
