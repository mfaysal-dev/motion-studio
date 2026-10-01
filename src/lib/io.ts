import { actions } from '../store'
import { normalizeProject, uid } from '../core/elements'
import { pickFile } from './upload'

export async function importProjectFile(): Promise<boolean> {
  const f = await pickFile('.json,application/json')
  if (!f) return false
  try {
    const p = normalizeProject(JSON.parse(await f.text()))
    p.id = uid('prj')
    actions.setProject(p)
    actions.toast(`Imported “${p.name}”`)
    return true
  } catch (e) {
    actions.toast((e as Error).message || 'Invalid project file')
    return false
  }
}
