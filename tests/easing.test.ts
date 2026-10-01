import { describe, it, expect } from 'vitest'
import { EASINGS, cubicBezier, ease, getEasing } from '../src/core/easing'

describe('easing', () => {
  it('every named easing maps 0→0 and 1→1', () => {
    for (const [name, fn] of Object.entries(EASINGS)) {
      if (name === 'step') continue
      expect(fn(0), name).toBeCloseTo(0, 5)
      expect(fn(1), name).toBeCloseTo(1, 5)
    }
  })
  it('quad curves have expected midpoints', () => {
    expect(EASINGS.easeInQuad(0.5)).toBeCloseTo(0.25)
    expect(EASINGS.easeOutQuad(0.5)).toBeCloseTo(0.75)
    expect(EASINGS.easeInOutCubic(0.5)).toBeCloseTo(0.5)
  })
  it('back easing overshoots', () => {
    const vals = Array.from({ length: 50 }, (_, i) => EASINGS.easeOutBack(i / 49))
    expect(Math.max(...vals)).toBeGreaterThan(1)
  })
  it('cubic-bezier matches linear for (0,0,1,1) and CSS ease is monotonic', () => {
    const lin = cubicBezier(0, 0, 1, 1)
    for (const t of [0.1, 0.3, 0.5, 0.9]) expect(lin(t)).toBeCloseTo(t, 4)
    const css = getEasing('cubic-bezier(0.25, 0.1, 0.25, 1)')
    let prev = -1
    for (let i = 0; i <= 20; i++) { const v = css(i / 20); expect(v).toBeGreaterThanOrEqual(prev); prev = v }
    expect(css(0.5)).toBeCloseTo(0.8024, 2)
  })
  it('ease() clamps input and falls back to linear for unknown names', () => {
    expect(ease('easeInQuad', 2)).toBe(1)
    expect(ease('easeInQuad', -1)).toBe(0)
    expect(ease('nope', 0.37)).toBeCloseTo(0.37)
  })
})
