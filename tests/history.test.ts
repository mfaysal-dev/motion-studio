import { describe, it, expect } from 'vitest'
import { History } from '../src/core/history'

describe('History', () => {
  it('undoes and redoes snapshots', () => {
    const h = new History<number>()
    let state = 0
    h.push(state); state = 1
    h.push(state); state = 2
    expect(h.canUndo).toBe(true)
    state = h.undo(state)!; expect(state).toBe(1)
    state = h.undo(state)!; expect(state).toBe(0)
    expect(h.undo(state)).toBeUndefined()
    state = h.redo(state)!; expect(state).toBe(1)
    state = h.redo(state)!; expect(state).toBe(2)
    expect(h.canRedo).toBe(false)
  })
  it('clears redo stack after a new change', () => {
    const h = new History<string>()
    h.push('a')
    const cur = h.undo('b')!
    expect(h.canRedo).toBe(true)
    h.push(cur)
    expect(h.canRedo).toBe(false)
  })
  it('coalesces rapid changes with the same key', () => {
    const h = new History<number>(100, 500)
    h.push(0, 'slider', 1000)
    h.push(1, 'slider', 1200)
    h.push(2, 'slider', 1400)
    expect(h.size).toBe(1)
    h.push(3, 'slider', 2500)
    expect(h.size).toBe(2)
    h.push(4, 'other', 2600)
    expect(h.size).toBe(3)
  })
  it('respects the limit', () => {
    const h = new History<number>(3)
    for (let i = 0; i < 10; i++) h.push(i)
    expect(h.size).toBe(3)
  })
})
