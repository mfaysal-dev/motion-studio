import { describe, it, expect } from 'vitest'
import { evaluate, makeClip, PRESETS, presetsOf, stagger } from '../src/core/animate'
import { createShape, createText } from '../src/core/elements'
import { snapRect } from '../src/core/geometry'

describe('animation presets', () => {
  it('ships 40+ presets across entrance / exit / emphasis', () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(40)
    expect(presetsOf('enter').length).toBeGreaterThan(20)
    expect(presetsOf('exit').length).toBeGreaterThan(20)
    expect(presetsOf('emphasis').length).toBeGreaterThan(15)
  })
  it('every entrance ends at identity and every exit starts at identity', () => {
    for (const p of presetsOf('enter')) {
      const el = createText({ text: 'Hello' })
      el.anim.enter = { ...makeClip('enter', p.id), delay: 0, duration: 1 }
      const end = evaluate(el, 1.0001)
      expect(end.state.opacity, p.id).toBeCloseTo(1)
      expect(end.state.dx, p.id).toBeCloseTo(0)
      expect(end.state.scaleX, p.id).toBeCloseTo(1)
      expect(end.state.perChar, p.id).toBeUndefined()
    }
  })
  it('fade in starts invisible and slide offsets position', () => {
    const el = createShape('rect', { width: 400 })
    el.anim.enter = { preset: 'fadeIn', duration: 1, delay: 0.5, easing: 'linear' }
    expect(evaluate(el, 0.2).state.opacity).toBeCloseTo(0)
    expect(evaluate(el, 1).state.opacity).toBeCloseTo(0.5)
    el.anim.enter = { preset: 'slideLeft', duration: 1, delay: 0, easing: 'linear' }
    expect(evaluate(el, 0).state.dx).toBeLessThan(0)
  })
  it('exit animations play at the end of the visibility window', () => {
    const el = createShape('rect')
    el.anim.end = 5
    el.anim.exit = { preset: 'fadeIn', duration: 1, delay: 0, easing: 'linear' }
    expect(evaluate(el, 3).state.opacity).toBeCloseTo(1)
    expect(evaluate(el, 4.5).state.opacity).toBeCloseTo(0.5)
    expect(evaluate(el, 6).visible).toBe(false)
  })
  it('typewriter reveals a fraction of characters and stagger is monotonic', () => {
    const el = createText({ text: 'abcdef' })
    el.anim.enter = { preset: 'typewriter', duration: 2, delay: 0, easing: 'linear' }
    expect(evaluate(el, 1).state.chars).toBeCloseTo(0.5)
    expect(stagger(0, 0, 10)).toBe(0)
    expect(stagger(1, 9, 10)).toBe(1)
    expect(stagger(0.5, 0, 10)).toBeGreaterThan(stagger(0.5, 5, 10))
  })
  it('emphasis loops with its period', () => {
    const el = createShape('rect')
    el.anim.emphasis = { preset: 'spin', duration: 2, delay: 0, easing: 'linear', loop: true }
    expect(evaluate(el, 1).state.rotation).toBeCloseTo(180)
    expect(evaluate(el, 3).state.rotation).toBeCloseTo(180)
  })
  it('keyframes drive base transform', () => {
    const el = createShape('rect', { x: 10 })
    el.anim.keyframes.x = [{ t: 0, value: 0, easing: 'linear' }, { t: 2, value: 200, easing: 'linear' }]
    expect(evaluate(el, 1).x).toBeCloseTo(100)
  })
})

describe('snapping', () => {
  it('snaps rect edges/centers to nearby guides', () => {
    const r = snapRect({ x: 97, y: 10, w: 100, h: 50 }, [100, 500], [300], 5)
    expect(r.dx).toBe(3)
    expect(r.dy).toBe(0)
    expect(r.guides).toEqual([{ axis: 'x', pos: 100 }])
  })
})
