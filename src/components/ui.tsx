import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { toHex } from '../lib/color'

export function Section({ title, children, right, defaultOpen = true }: { title: string; children: ReactNode; right?: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b border-line px-3 py-3">
      <div className="flex items-center justify-between">
        <button className="flex items-center gap-1 section-title" onClick={() => setOpen(!open)}>
          <ChevronDown size={13} className={`transition-transform ${open ? '' : '-rotate-90'}`} />
          {title}
        </button>
        {right}
      </div>
      {open && <div className="mt-3 space-y-2.5">{children}</div>}
    </div>
  )
}

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-[74px] shrink-0 text-muted text-[12px]">{label}</span>
      <div className="flex-1 min-w-0 flex items-center gap-2">{children}</div>
    </div>
  )
}

export function Slider({ label, value, min, max, step = 1, onChange, suffix = '', onStart, onEnd }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; suffix?: string; onStart?: () => void; onEnd?: () => void }) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <Row label={label}>
      <input
        type="range" className="range flex-1 w-full" min={min} max={max} step={step} value={value}
        style={{ ['--pct' as string]: `${Math.max(0, Math.min(100, pct))}%` }}
        onPointerDown={onStart} onPointerUp={onEnd}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      <NumberInput value={value} onChange={onChange} step={step} className="w-[58px]" suffix={suffix} />
    </Row>
  )
}

export function NumberInput({ value, onChange, step = 1, className = '', suffix = '', min, max, label }: { value: number; onChange: (v: number) => void; step?: number; className?: string; suffix?: string; min?: number; max?: number; label?: string }) {
  const [draft, setDraft] = useState<string | null>(null)
  const show = draft ?? (Number.isInteger(step) ? Math.round(value).toString() : (Math.round(value * 100) / 100).toString())
  const commit = (s: string) => {
    const v = parseFloat(s)
    if (Number.isFinite(v)) onChange(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v)))
    setDraft(null)
  }
  return (
    <label className={`field flex items-center gap-1 px-2 ${className}`}>
      {label && <span className="text-muted text-[11px] font-semibold">{label}</span>}
      <input
        className="w-full bg-transparent outline-none text-right tabular-nums" value={show}
        aria-label={label}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault()
            const d = (e.key === 'ArrowUp' ? 1 : -1) * step * (e.shiftKey ? 10 : 1)
            onChange(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, value + d)))
          }
          e.stopPropagation()
        }}
      />
      {suffix && <span className="text-muted text-[11px]">{suffix}</span>}
    </label>
  )
}

export function ColorInput({ value, onChange, className = '' }: { value: string; onChange: (v: string) => void; className?: string }) {
  const hex = toHex(value)
  return (
    <div className={`field flex items-center gap-2 px-1.5 ${className}`}>
      <label className="relative w-5 h-5 rounded-md overflow-hidden checker shrink-0 border border-line">
        <span className="absolute inset-0" style={{ background: value }} />
        <input type="color" value={hex} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" />
      </label>
      <input className="w-full bg-transparent outline-none uppercase text-[12px] tabular-nums" value={value} onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => e.stopPropagation()} spellCheck={false} />
    </div>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className={`relative w-8 h-[18px] rounded-full transition-colors ${checked ? 'grad-bg' : 'bg-panel3'}`}>
      <span className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow transition-all ${checked ? 'left-[16px]' : 'left-[2px]'}`} />
    </button>
  )
}

export function Select<T extends string>({ value, onChange, options, className = '' }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; className?: string }) {
  return (
    <select className={`field ${className}`} value={value} onChange={(e) => onChange(e.target.value as T)} onKeyDown={(e) => e.stopPropagation()}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode; title?: string }[] }) {
  return (
    <div className="flex bg-panel2 border border-line rounded-[9px] p-[2px] gap-[2px] w-full">
      {options.map((o) => (
        <button key={o.value} title={o.title} onClick={() => onChange(o.value)} className={`flex-1 h-[24px] rounded-[7px] text-[12px] flex items-center justify-center transition-colors ${value === o.value ? 'bg-panel3 text-ink shadow-sm' : 'text-muted hover:text-ink'}`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Modal({ title, onClose, children, width = 720 }: { title: ReactNode; onClose: () => void; children: ReactNode; width?: number }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 backdrop-blur-sm p-4" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="pop-in bg-panel border border-line rounded-2xl w-full max-h-[88vh] flex flex-col" style={{ maxWidth: width, boxShadow: 'var(--shadow)' }}>
        <div className="flex items-center justify-between px-5 h-14 border-b border-line shrink-0">
          <div className="font-display font-bold text-[16px]">{title}</div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="overflow-auto">{children}</div>
      </div>
    </div>
  )
}
