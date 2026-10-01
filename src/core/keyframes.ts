import type { Keyframe } from './types'
import { ease } from './easing'

/** Interpolate a sorted-or-unsorted keyframe track at time t. Easing of a keyframe applies to the segment that starts at it. */
export function interpolate(track: Keyframe[] | undefined, t: number, fallback: number): number {
  if (!track || track.length === 0) return fallback
  const kfs = track.length > 1 ? [...track].sort((a, b) => a.t - b.t) : track
  if (t <= kfs[0].t) return kfs[0].value
  const last = kfs[kfs.length - 1]
  if (t >= last.t) return last.value
  for (let i = 0; i < kfs.length - 1; i++) {
    const a = kfs[i], b = kfs[i + 1]
    if (t >= a.t && t <= b.t) {
      const span = b.t - a.t
      if (span <= 0) return b.value
      const p = ease(a.easing, (t - a.t) / span)
      return a.value + (b.value - a.value) * p
    }
  }
  return last.value
}

/** Insert or replace a keyframe at time t (within epsilon). Returns a new sorted track. */
export function upsertKeyframe(track: Keyframe[] | undefined, t: number, value: number, easing = 'easeInOutCubic', eps = 1 / 60): Keyframe[] {
  const out = (track ?? []).filter((k) => Math.abs(k.t - t) > eps)
  const existing = (track ?? []).find((k) => Math.abs(k.t - t) <= eps)
  out.push({ t, value, easing: existing?.easing ?? easing })
  return out.sort((a, b) => a.t - b.t)
}

export function removeKeyframe(track: Keyframe[] | undefined, t: number, eps = 1 / 60): Keyframe[] {
  return (track ?? []).filter((k) => Math.abs(k.t - t) > eps)
}
