import { create } from 'zustand'
import { produce, type Draft } from 'immer'
import type { AnimProp, DesignElement, Project, TextElement } from './core/types'
import { History } from './core/history'
import { interpolate, upsertKeyframe, removeKeyframe } from './core/keyframes'
import { layoutText } from './core/text'
import { aabb, unionRects } from './core/geometry'
import { uid, emptyProject } from './core/elements'
import { KEYFRAME_PROPS } from './core/animate'

export type Tool = 'select' | 'hand' | 'text' | 'rect' | 'ellipse' | 'polygon' | 'star' | 'line' | 'arrow' | 'pen' | 'brush' | 'eraser'
export type BrushType = 'pencil' | 'brush' | 'marker' | 'highlighter'
export interface BrushSettings { type: BrushType; size: number; color: string; opacity: number; smoothing: number; eraserSize: number }
export type Modal = null | 'export' | 'templates' | 'projects' | 'shortcuts'

export interface Guide { axis: 'x' | 'y'; pos: number }

interface State {
  project: Project
  selection: string[]
  tool: Tool
  brush: BrushSettings
  zoom: number
  panX: number
  panY: number
  viewport: { w: number; h: number }
  time: number
  playing: boolean
  loopPlayback: boolean
  /** true = static design editing (no preset motion) */
  designView: boolean
  theme: 'dark' | 'light'
  guides: Guide[]
  snapping: boolean
  editingTextId: string | null
  canUndo: boolean
  canRedo: boolean
  leftTab: 'layers' | 'styles' | 'elements' | 'draw'
  rightTab: 'design' | 'animate'
  timelineOpen: boolean
  modal: Modal
  toast: { id: number; msg: string } | null
  renderTick: number
}

const history = new History<Project>(150, 700)
let gestureSnapshot: Project | null = null
let clipboard: DesignElement[] = []

/** keep text box sizes in sync with layout */
function syncText(p: Project): Project {
  let changed = false
  const els = p.elements.map((e) => {
    if (e.type !== 'text') return e
    const L = layoutText(e)
    if (Math.abs(L.width - e.width) > 0.01 || Math.abs(L.height - e.height) > 0.01) { changed = true; return { ...e, width: L.width, height: L.height } as TextElement }
    return e
  })
  return changed ? { ...p, elements: els } : p
}

export function expandGroups(p: Project, ids: string[]): string[] {
  const groups = new Set(p.elements.filter((e) => ids.includes(e.id) && e.groupId).map((e) => e.groupId!))
  if (!groups.size) return ids
  const out = new Set(ids)
  for (const e of p.elements) if (e.groupId && groups.has(e.groupId)) out.add(e.id)
  return [...out]
}

/** element with keyframed transform resolved at time t (for interaction/selection) */
export function resolved(el: DesignElement, t: number): DesignElement {
  const kf = el.anim.keyframes
  if (!kf || !Object.values(kf).some((v) => v && v.length)) return el
  const s = interpolate(kf.scale, t, 1)
  return { ...el, x: interpolate(kf.x, t, el.x), y: interpolate(kf.y, t, el.y), rotation: interpolate(kf.rotation, t, el.rotation), width: el.width * s, height: el.height * s } as DesignElement
}

/** set x/y/rotation honoring keyframes (auto-key in animate view, offset all keys in design view) */
export function setAnimated(el: Draft<DesignElement>, prop: 'x' | 'y' | 'rotation', value: number, t: number, designView: boolean) {
  const tr = el.anim.keyframes[prop]
  if (tr && tr.length) {
    if (designView) {
      const cur = interpolate(tr, t, el[prop])
      const d = value - cur
      el.anim.keyframes[prop] = tr.map((k) => ({ ...k, value: k.value + d }))
    } else el.anim.keyframes[prop] = upsertKeyframe(tr, t, value)
  }
  el[prop] = value
}

let toastId = 0

export const useStore = create<State>()(() => ({
  project: emptyProject(),
  selection: [],
  tool: 'select',
  brush: { type: 'brush', size: 14, color: '#ff4fd8', opacity: 1, smoothing: 0.5, eraserSize: 40 },
  zoom: 0.5,
  panX: 0,
  panY: 0,
  viewport: { w: 800, h: 600 },
  time: 0,
  playing: false,
  loopPlayback: true,
  designView: true,
  theme: (typeof localStorage !== 'undefined' && (localStorage.getItem('kinetica:theme') as 'dark' | 'light')) || 'dark',
  guides: [],
  snapping: true,
  editingTextId: null,
  canUndo: false,
  canRedo: false,
  leftTab: 'layers',
  rightTab: 'design',
  timelineOpen: true,
  modal: null,
  toast: null,
  renderTick: 0,
}))

const set = useStore.setState
const get = useStore.getState

function syncHistoryFlags() { set({ canUndo: history.canUndo, canRedo: history.canRedo }) }

export const actions = {
  toast(msg: string) {
    const id = ++toastId
    set({ toast: { id, msg } })
    setTimeout(() => { if (get().toast?.id === id) set({ toast: null }) }, 2600)
  },
  setProject(p: Project, resetHistory = true) {
    if (resetHistory) history.clear()
    else history.push(get().project)
    set({ project: syncText(p), selection: [], time: 0, playing: false, editingTextId: null })
    syncHistoryFlags()
    actions.fitView()
  },
  /** apply an undoable change */
  commit(recipe: (d: Draft<Project>) => void, key?: string) {
    const prev = get().project
    const next = syncText(produce(prev, recipe))
    if (next === prev) return
    if (!gestureSnapshot) history.push(prev, key)
    set({ project: { ...next, updatedAt: Date.now() } })
    syncHistoryFlags()
  },
  begin() { gestureSnapshot = get().project },
  live(recipe: (d: Draft<Project>) => void) {
    set({ project: syncText(produce(get().project, recipe)) })
  },
  end() {
    if (gestureSnapshot && gestureSnapshot !== get().project) {
      history.push(gestureSnapshot)
      set({ project: { ...get().project, updatedAt: Date.now() } })
    }
    gestureSnapshot = null
    set({ guides: [] })
    syncHistoryFlags()
  },
  undo() {
    const p = history.undo(get().project)
    if (p) { set({ project: p, selection: get().selection.filter((id) => p.elements.some((e) => e.id === id)) }) }
    syncHistoryFlags()
  },
  redo() {
    const p = history.redo(get().project)
    if (p) set({ project: p, selection: get().selection.filter((id) => p.elements.some((e) => e.id === id)) })
    syncHistoryFlags()
  },
  select(ids: string[], mode: 'replace' | 'add' | 'toggle' = 'replace') {
    const p = get().project
    const exp = expandGroups(p, ids)
    let sel = get().selection
    if (mode === 'replace') sel = exp
    else if (mode === 'add') sel = [...new Set([...sel, ...exp])]
    else {
      const allIn = exp.every((id) => sel.includes(id))
      sel = allIn ? sel.filter((id) => !exp.includes(id)) : [...new Set([...sel, ...exp])]
    }
    set({ selection: sel, editingTextId: null })
  },
  selectAll() { set({ selection: get().project.elements.filter((e) => !e.locked && e.visible).map((e) => e.id) }) },
  addElements(els: DesignElement[], select = true) {
    actions.commit((d) => { d.elements.push(...(els as Draft<DesignElement>[])) })
    if (select) set({ selection: els.map((e) => e.id) })
  },
  updateSelected(recipe: (el: Draft<DesignElement>) => void, key?: string) {
    const ids = new Set(get().selection)
    actions.commit((d) => { for (const el of d.elements) if (ids.has(el.id)) recipe(el) }, key)
  },
  updateEl(id: string, recipe: (el: Draft<DesignElement>) => void, key?: string) {
    actions.commit((d) => { const el = d.elements.find((e) => e.id === id); if (el) recipe(el) }, key)
  },
  deleteSelection() {
    const ids = new Set(get().selection)
    if (!ids.size) return
    actions.commit((d) => { d.elements = d.elements.filter((e) => !ids.has(e.id)) })
    set({ selection: [] })
  },
  copy() {
    const ids = new Set(get().selection)
    clipboard = structuredClone(get().project.elements.filter((e) => ids.has(e.id)))
    try { localStorage.setItem('kinetica:clipboard', JSON.stringify(clipboard)) } catch { /* quota */ }
    if (clipboard.length) actions.toast(`Copied ${clipboard.length} layer${clipboard.length > 1 ? 's' : ''}`)
  },
  cut() { actions.copy(); actions.deleteSelection() },
  paste(offset = 24) {
    let src = clipboard
    if (!src.length) { try { src = JSON.parse(localStorage.getItem('kinetica:clipboard') || '[]') } catch { src = [] } }
    if (!src.length) return
    const groupMap = new Map<string, string>()
    const els = src.map((e) => {
      const c = structuredClone(e)
      c.id = uid()
      c.x += offset; c.y += offset
      for (const k of ['x', 'y'] as const) { const tr = c.anim.keyframes[k]; if (tr) c.anim.keyframes[k] = tr.map((f) => ({ ...f, value: f.value + offset })) }
      if (c.groupId) { if (!groupMap.has(c.groupId)) groupMap.set(c.groupId, uid('grp')); c.groupId = groupMap.get(c.groupId) }
      return c
    })
    clipboard = structuredClone(els)
    actions.addElements(els)
  },
  duplicate() { const keep = clipboard; actions.copy(); actions.paste(); clipboard = keep },
  group() {
    const sel = get().selection
    if (sel.length < 2) return
    const g = uid('grp')
    actions.commit((d) => { for (const el of d.elements) if (sel.includes(el.id)) el.groupId = g })
    actions.toast('Grouped')
  },
  ungroup() {
    const sel = get().selection
    actions.commit((d) => { for (const el of d.elements) if (sel.includes(el.id)) delete el.groupId })
  },
  reorder(dir: 'up' | 'down' | 'top' | 'bottom') {
    const ids = new Set(get().selection)
    if (!ids.size) return
    actions.commit((d) => {
      const els = d.elements
      const picked = els.filter((e) => ids.has(e.id))
      const rest = els.filter((e) => !ids.has(e.id))
      if (dir === 'top') { d.elements = [...rest, ...picked]; return }
      if (dir === 'bottom') { d.elements = [...picked, ...rest]; return }
      const arr = [...els]
      if (dir === 'up') { for (let i = arr.length - 2; i >= 0; i--) if (ids.has(arr[i].id) && !ids.has(arr[i + 1].id)) [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]] }
      else for (let i = 1; i < arr.length; i++) if (ids.has(arr[i].id) && !ids.has(arr[i - 1].id)) [arr[i], arr[i - 1]] = [arr[i - 1], arr[i]]
      d.elements = arr
    })
  },
  /** move layer id to array index */
  moveLayer(id: string, toIndex: number) {
    actions.commit((d) => {
      const from = d.elements.findIndex((e) => e.id === id)
      if (from < 0) return
      const [el] = d.elements.splice(from, 1)
      d.elements.splice(Math.max(0, Math.min(d.elements.length, toIndex)), 0, el)
    })
  },
  align(kind: 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom') {
    const { project, selection, time, designView } = get()
    const els = project.elements.filter((e) => selection.includes(e.id)).map((e) => resolved(e, time))
    if (!els.length) return
    const groupIds = new Set(els.map((e) => e.groupId).filter(Boolean))
    const singleGroup = groupIds.size === 1 && els.every((e) => e.groupId)
    const target = els.length === 1 || singleGroup ? { x: 0, y: 0, w: project.artboard.width, h: project.artboard.height } : unionRects(els.map(aabb))!
    // when a single group is selected, move the group as a block
    const units = singleGroup ? [{ ids: els.map((e) => e.id), r: unionRects(els.map(aabb))! }] : els.map((e) => ({ ids: [e.id], r: aabb(e) }))
    actions.commit((d) => {
      for (const u of units) {
        let dx = 0, dy = 0
        if (kind === 'left') dx = target.x - u.r.x
        if (kind === 'hcenter') dx = target.x + target.w / 2 - (u.r.x + u.r.w / 2)
        if (kind === 'right') dx = target.x + target.w - (u.r.x + u.r.w)
        if (kind === 'top') dy = target.y - u.r.y
        if (kind === 'vcenter') dy = target.y + target.h / 2 - (u.r.y + u.r.h / 2)
        if (kind === 'bottom') dy = target.y + target.h - (u.r.y + u.r.h)
        for (const el of d.elements) if (u.ids.includes(el.id)) {
          const r = resolved(el as DesignElement, time)
          if (dx) setAnimated(el, 'x', r.x + dx, time, designView)
          if (dy) setAnimated(el, 'y', r.y + dy, time, designView)
        }
      }
    })
  },
  distribute(axis: 'x' | 'y') {
    const { project, selection, time, designView } = get()
    const els = project.elements.filter((e) => selection.includes(e.id)).map((e) => resolved(e, time))
    if (els.length < 3) { actions.toast('Select 3+ layers to distribute'); return }
    const items = els.map((e) => ({ id: e.id, r: aabb(e), c: e })).sort((a, b) => (axis === 'x' ? a.r.x - b.r.x : a.r.y - b.r.y))
    const first = items[0].r, last = items[items.length - 1].r
    const span = axis === 'x' ? last.x + last.w - first.x : last.y + last.h - first.y
    const total = items.reduce((s, i) => s + (axis === 'x' ? i.r.w : i.r.h), 0)
    const gap = (span - total) / (items.length - 1)
    let cursor = axis === 'x' ? first.x : first.y
    const moves = new Map<string, number>()
    for (const it of items) {
      const cur = axis === 'x' ? it.r.x : it.r.y
      moves.set(it.id, cursor - cur)
      cursor += (axis === 'x' ? it.r.w : it.r.h) + gap
    }
    actions.commit((d) => { for (const el of d.elements) { const m = moves.get(el.id); if (m) { const r = resolved(el as DesignElement, time); setAnimated(el, axis, r[axis] + m, time, designView) } } })
  },
  nudge(dx: number, dy: number) {
    const { selection, time, designView } = get()
    actions.commit((d) => {
      for (const el of d.elements) if (selection.includes(el.id) && !el.locked) {
        const r = resolved(el as DesignElement, time)
        if (dx) setAnimated(el, 'x', r.x + dx, time, designView)
        if (dy) setAnimated(el, 'y', r.y + dy, time, designView)
      }
    }, 'nudge')
  },
  addKeyframe(id: string) {
    const t = get().time
    actions.updateEl(id, (el) => {
      const kf = el.anim.keyframes
      for (const p of KEYFRAME_PROPS) {
        const base = p === 'scale' || p === 'opacity' ? 1 : (el as unknown as Record<string, number>)[p]
        kf[p] = upsertKeyframe(kf[p], t, interpolate(kf[p], t, base))
      }
    })
    set({ designView: false })
    actions.toast(`Keyframe added at ${t.toFixed(2)}s`)
  },
  setKeyframeValue(id: string, prop: AnimProp, value: number) {
    const t = get().time
    actions.updateEl(id, (el) => { el.anim.keyframes[prop] = upsertKeyframe(el.anim.keyframes[prop], t, value) }, `kf-${prop}`)
  },
  removeKeyframesAt(id: string, t: number) {
    actions.updateEl(id, (el) => { for (const p of KEYFRAME_PROPS) { const tr = removeKeyframe(el.anim.keyframes[p], t); if (tr.length) el.anim.keyframes[p] = tr; else delete el.anim.keyframes[p] } })
  },
  clearKeyframes(id: string) { actions.updateEl(id, (el) => { el.anim.keyframes = {} }) },
  setTime(t: number) {
    const d = get().project.duration
    set({ time: Math.max(0, Math.min(d, t)), designView: false })
  },
  play() {
    const { time, project } = get()
    set({ playing: true, designView: false, editingTextId: null, time: time >= project.duration - 0.01 ? 0 : time })
  },
  pause() { set({ playing: false }) },
  togglePlay() { if (get().playing) actions.pause(); else actions.play() },
  setDesignView(v: boolean) { set({ designView: v, playing: v ? false : get().playing }) },
  setArtboard(w: number, h: number) {
    const { width, height } = get().project.artboard
    const dx = (w - width) / 2, dy = (h - height) / 2
    actions.commit((d) => {
      d.artboard.width = w; d.artboard.height = h
      for (const el of d.elements) {
        el.x += dx; el.y += dy
        for (const k of ['x', 'y'] as const) { const tr = el.anim.keyframes[k]; if (tr) el.anim.keyframes[k] = tr.map((f) => ({ ...f, value: f.value + (k === 'x' ? dx : dy) })) }
      }
    })
    actions.fitView()
  },
  setDuration(sec: number) {
    const d = Math.max(1, Math.min(120, sec))
    const old = get().project.duration
    actions.commit((p) => {
      p.duration = d
      for (const el of p.elements) {
        if (Math.abs(el.anim.end - old) < 1e-3 || el.anim.end > d) el.anim.end = d
        if (el.anim.start > d - 0.1) el.anim.start = Math.max(0, d - 0.5)
      }
    }, 'duration')
    if (get().time > d) set({ time: d })
  },
  fitView() {
    const { viewport, project } = get()
    const pad = 64
    const z = Math.max(0.02, Math.min((viewport.w - pad * 2) / project.artboard.width, (viewport.h - pad * 2) / project.artboard.height, 4))
    set({ zoom: z, panX: Math.round((viewport.w - project.artboard.width * z) / 2), panY: Math.round((viewport.h - project.artboard.height * z) / 2) })
  },
  zoomAt(z: number, sx?: number, sy?: number) {
    const { zoom, panX, panY, viewport } = get()
    const nz = Math.max(0.02, Math.min(16, z))
    const ax = sx ?? viewport.w / 2, ay = sy ?? viewport.h / 2
    const wx = (ax - panX) / zoom, wy = (ay - panY) / zoom
    set({ zoom: nz, panX: ax - wx * nz, panY: ay - wy * nz })
  },
  setTheme(t: 'dark' | 'light') { set({ theme: t }); try { localStorage.setItem('kinetica:theme', t) } catch { /* ignore */ } },
  rerender() { set({ renderTick: get().renderTick + 1 }) },
  resyncText() { set({ project: syncText(get().project) }) },
}

export const getState = get
