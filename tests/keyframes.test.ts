import { describe, it, expect } from 'vitest'
import { interpolate, upsertKeyframe, removeKeyframe } from '../src/core/keyframes'
import type { Keyframe } from '../src/core/types'

const track: Keyframe[] = [
  { t: 0, value: 0, easing: 'linear' },
  { t: 2, value: 100, easing: 'easeInQuad' },
  { t: 4, value: 50, easing: 'linear' },
]

describe('keyframe interpolation', () => {
  it('returns fallback with no track', () => {
    expect(interpolate(undefined, 1, 42)).toBe(42)
    expect(interpolate([], 1, 7)).toBe(7)
  })
  it('holds first/last values outside the range', () => {
    expect(interpolate(track, -1, 0)).toBe(0)
    expect(interpolate(track, 10, 0)).toBe(50)
  })
  it('interpolates linearly and with the segment easing', () => {
    expect(interpolate(track, 1, 0)).toBeCloseTo(50)
    // easeInQuad from 100 → 50 at halfway: 100 - 50 * 0.25
    expect(interpolate(track, 3, 0)).toBeCloseTo(87.5)
  })
  it('handles unsorted tracks', () => {
    const shuffled = [track[2], track[0], track[1]]
    expect(interpolate(shuffled, 1, 0)).toBeCloseTo(50)
  })
  it('upserts and removes keyframes', () => {
    let t2 = upsertKeyframe(track, 1, 10)
    expect(t2.map((k) => k.t)).toEqual([0, 1, 2, 4])
    t2 = upsertKeyframe(t2, 1.001, 20)
    expect(t2).toHaveLength(4)
    expect(t2[1].value).toBe(20)
    expect(removeKeyframe(t2, 1)).toHaveLength(3)
  })
})
