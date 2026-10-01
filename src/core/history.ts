/** Generic undo/redo history of immutable snapshots with optional coalescing. */
export class History<T> {
  private past: T[] = []
  private future: T[] = []
  private lastKey: string | null = null
  private lastTime = 0
  readonly limit: number
  readonly coalesceMs: number

  constructor(limit = 120, coalesceMs = 600) {
    this.limit = limit
    this.coalesceMs = coalesceMs
  }

  /** Record `prev` (the state before a change). Changes with the same key within coalesceMs merge into one step. */
  push(prev: T, key?: string, now = Date.now()) {
    if (key && key === this.lastKey && now - this.lastTime < this.coalesceMs && this.past.length > 0) {
      this.lastTime = now
      this.future = []
      return
    }
    this.past.push(prev)
    if (this.past.length > this.limit) this.past.shift()
    this.future = []
    this.lastKey = key ?? null
    this.lastTime = now
  }

  undo(current: T): T | undefined {
    const prev = this.past.pop()
    if (prev === undefined) return undefined
    this.future.push(current)
    this.lastKey = null
    return prev
  }

  redo(current: T): T | undefined {
    const next = this.future.pop()
    if (next === undefined) return undefined
    this.past.push(current)
    this.lastKey = null
    return next
  }

  clear() {
    this.past = []
    this.future = []
    this.lastKey = null
  }

  get canUndo() { return this.past.length > 0 }
  get canRedo() { return this.future.length > 0 }
  get size() { return this.past.length }
}
