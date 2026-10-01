import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval'
import type { Project } from '../core/types'

export interface ProjectMeta { id: string; name: string; updatedAt: number; thumb?: string; w: number; h: number }

const INDEX = 'kinetica:index'
const LAST = 'kinetica:last'

async function kvGet<T>(key: string): Promise<T | undefined> {
  try { return await idbGet<T>(key) } catch {
    const v = localStorage.getItem(key)
    return v ? (JSON.parse(v) as T) : undefined
  }
}
async function kvSet(key: string, value: unknown) {
  try { await idbSet(key, value) } catch { localStorage.setItem(key, JSON.stringify(value)) }
}
async function kvDel(key: string) {
  try { await idbDel(key) } catch { localStorage.removeItem(key) }
}

export async function listProjects(): Promise<ProjectMeta[]> {
  const idx = (await kvGet<ProjectMeta[]>(INDEX)) ?? []
  return [...idx].sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function saveProject(p: Project, thumb?: string) {
  await kvSet(`kinetica:project:${p.id}`, p)
  const idx = (await kvGet<ProjectMeta[]>(INDEX)) ?? []
  const meta: ProjectMeta = { id: p.id, name: p.name, updatedAt: Date.now(), thumb: thumb ?? idx.find((m) => m.id === p.id)?.thumb, w: p.artboard.width, h: p.artboard.height }
  await kvSet(INDEX, [meta, ...idx.filter((m) => m.id !== p.id)])
  try { localStorage.setItem(LAST, p.id) } catch { /* ignore */ }
}

export async function loadProject(id: string): Promise<Project | undefined> {
  return kvGet<Project>(`kinetica:project:${id}`)
}

export async function deleteProject(id: string) {
  await kvDel(`kinetica:project:${id}`)
  const idx = (await kvGet<ProjectMeta[]>(INDEX)) ?? []
  await kvSet(INDEX, idx.filter((m) => m.id !== id))
}

export function lastProjectId(): string | null {
  try { return localStorage.getItem(LAST) } catch { return null }
}
